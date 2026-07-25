// Ingestor automático de notícias regionais e nacionais.
//
// Lê os feeds RSS de duas fontes autorizadas, cria uma notícia em modo RASCUNHO
// (status DRAFT) para cada item novo — nunca publica sozinho. Um administrador
// humano revisa e publica pelo painel (/admin). Isso evita publicar automaticamente
// algo incorreto, desatualizado ou fora do padrão editorial do portal.
//
// Fontes:
//  - Fato Regional (regional, sul do Pará) — conteúdo com "todos os direitos
//    reservados"; por isso usamos só resumo + atribuição + link, nunca o texto
//    integral.
//  - Agência Brasil / EBC (nacional) — termos de uso autorizam expressamente
//    "reprodução mediante indicação da fonte".
//
// Uso: npm run ingest  (ou `tsx scripts/ingest-news.ts`)
import { PrismaClient } from '../generated/prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { XMLParser } from 'fast-xml-parser';

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? 'file:./dev.db',
});
const prisma = new PrismaClient({ adapter });

const AUTHOR_SLUG = 'redacao';
const ITEMS_PER_SOURCE = 6;

type FeedSource = {
  name: string;
  url: string;
  feedLabel: string;
  fallbackCategory: string;
  fallbackIcon: string;
};

const SOURCES: FeedSource[] = [
  {
    name: 'Fato Regional',
    url: 'https://www.fatoregional.com.br/feed/',
    feedLabel: 'regional',
    fallbackCategory: 'regional',
    fallbackIcon: '📍',
  },
  {
    name: 'Agência Brasil',
    url: 'http://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml',
    feedLabel: 'nacional',
    fallbackCategory: 'brasil',
    fallbackIcon: '🇧🇷',
  },
];

// Palavras-chave (sem acento, minúsculas) usadas para mapear as categorias do
// feed de origem para as categorias já existentes no portal. Sem correspondência,
// cai no fallbackCategory de cada fonte (regional ou brasil).
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  politica: [
    'politica',
    'eleic',
    'deputad',
    'prefeit',
    'camara',
    'governo',
    'vereador',
    'senad',
  ],
  policia: [
    'policia',
    'crime',
    'violenc',
    'homicid',
    'acident',
    'pm ',
    'seguranca publica',
    'justica',
    'chacina',
    'operacao',
  ],
  agronegocio: [
    'agronegocio',
    'agro',
    'pecuaria',
    'soja',
    'milho',
    'lavoura',
    'rural',
    'boi',
    'colheita',
  ],
  economia: [
    'economia',
    'emprego',
    'inflac',
    'pib',
    'mercado',
    'imposto',
    'gasolina',
    'dolar',
    'tarifa',
  ],
  esportes: ['esporte', 'futebol', 'copa', 'campeonato', 'jogo', 'atleta'],
  saude: ['saude', 'hospital', 'vacina', 'dengue', 'sus', 'medic'],
  educacao: [
    'educacao',
    'escola',
    'universidade',
    'enem',
    'aluno',
    'professor',
  ],
  tecnologia: ['tecnolog', 'internet', ' ia ', 'celular', 'digital', 'app'],
};

const CATEGORY_ICON: Record<string, string> = {
  politica: '🏛️',
  policia: '🚔',
  agronegocio: '🌾',
  economia: '💰',
  esportes: '⚽',
  saude: '🏥',
  educacao: '🎓',
  tecnologia: '💻',
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&'); // por último: entidades acima podem conter "&" a decodificar
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLen)}…`;
}

function mapCategory(rawCategories: string[], fallback: string): string {
  const normalized = rawCategories.map((c) => normalize(c));
  for (const [slug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (normalized.some((c) => keywords.some((kw) => c.includes(kw)))) {
      return slug;
    }
  }
  return fallback;
}

type FeedItem = {
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
  categories: string[];
};

// Formato bruto do XML parseado — os campos existem "se o feed os trouxer",
// por isso tudo é `unknown`: validamos/convertemos explicitamente abaixo.
type RawFeedItem = {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  description?: unknown;
  category?: unknown;
};
type RawFeed = { rss?: { channel?: { item?: RawFeedItem | RawFeedItem[] } } };

// fast-xml-parser normalmente entrega texto/CDATA como string, mas o tipo é `unknown`
// (schema do feed não é garantido) — números viram string, qualquer outra coisa vira "".
function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function parseFeed(xml: string): FeedItem[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const doc = parser.parse(xml) as RawFeed;
  const rawItems = doc.rss?.channel?.item ?? [];
  const items: RawFeedItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items
    .filter((item): item is RawFeedItem => Boolean(item?.title && item?.link))
    .map((item) => {
      const rawCategories = item.category
        ? Array.isArray(item.category)
          ? item.category
          : [item.category]
        : [];
      return {
        title: stripHtml(toText(item.title)),
        link: decodeEntities(toText(item.link)).trim(),
        pubDate: item.pubDate ? toText(item.pubDate) : undefined,
        description: item.description
          ? stripHtml(toText(item.description))
          : '',
        categories: rawCategories.map((c) => toText(c)),
      };
    });
}

async function fetchFeed(source: FeedSource): Promise<FeedItem[]> {
  const res = await fetch(source.url, {
    headers: {
      'User-Agent':
        'PortalTucumaMilgrauBot/1.0 (+ingestor de noticias regionais/nacionais)',
    },
  });
  if (!res.ok) {
    throw new Error(
      `Falha ao buscar feed de ${source.name}: HTTP ${res.status}`,
    );
  }
  const xml = await res.text();
  return parseFeed(xml).slice(0, ITEMS_PER_SOURCE);
}

async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title) || 'noticia';
  let slug = base;
  let suffix = 2;
  while (await prisma.news.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  return slug;
}

function formatDate(pubDate: string | undefined): string {
  const date = pubDate ? new Date(pubDate) : new Date();
  if (Number.isNaN(date.getTime()))
    return new Date().toLocaleDateString('pt-BR');
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

async function ingestSource(source: FeedSource) {
  console.log(`\n→ Buscando feed de ${source.name} (${source.url})...`);
  let items: FeedItem[];
  try {
    items = await fetchFeed(source);
  } catch (err) {
    console.error(
      `  ✗ Erro ao buscar/ler o feed de ${source.name}:`,
      (err as Error).message,
    );
    return { created: 0, skipped: 0 };
  }
  console.log(`  ${items.length} itens encontrados no feed.`);

  const author = await prisma.author.findUnique({
    where: { slug: AUTHOR_SLUG },
  });
  if (!author) {
    console.error(
      `  ✗ Autor "${AUTHOR_SLUG}" não existe no banco — rode o seed antes de ingerir.`,
    );
    return { created: 0, skipped: 0 };
  }

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const existing = await prisma.news.findUnique({
      where: { sourceUrl: item.link },
    });
    if (existing) {
      skipped += 1;
      continue;
    }

    const categorySlug = mapCategory(item.categories, source.fallbackCategory);
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });
    if (!category) {
      console.warn(
        `  ⚠ Categoria "${categorySlug}" não encontrada, pulando item: ${item.title}`,
      );
      skipped += 1;
      continue;
    }

    const excerpt = truncate(item.description || item.title, 220);
    const body = [
      item.description || item.title,
      `Matéria original de ${source.name}, publicada em ${formatDate(item.pubDate)}. ` +
        `Leia a reportagem completa na fonte: ${item.link}`,
    ].join('\n\n');

    const slug = await generateUniqueSlug(item.title);

    await prisma.news.create({
      data: {
        slug,
        title: item.title,
        subtitle: '',
        excerpt,
        body,
        coverIcon: CATEGORY_ICON[categorySlug] ?? source.fallbackIcon,
        readTimeMin: Math.max(3, Math.round(body.split(/\s+/).length / 200)),
        status: 'DRAFT',
        categoryId: category.id,
        authorId: author.id,
        sourceUrl: item.link,
        sourceName: source.name,
      },
    });
    created += 1;
    console.log(`  + [rascunho criado] (${categorySlug}) ${item.title}`);
  }

  return { created, skipped };
}

async function main() {
  console.log('Ingestão automática de notícias — Portal Tucumã Milgrau');
  console.log(
    'Todas as notícias entram como RASCUNHO. Nada é publicado sem revisão humana no /admin.',
  );

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const source of SOURCES) {
    const { created, skipped } = await ingestSource(source);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log(
    `\nResumo: ${totalCreated} rascunho(s) novo(s) criado(s), ${totalSkipped} item(ns) já existente(s) ou ignorado(s).`,
  );
  if (totalCreated === 0) {
    console.log('Nenhuma notícia nova desde a última execução.');
  } else {
    console.log(
      'Revise e publique em http://localhost:3000/admin (aba Gestão de Notícias).',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
