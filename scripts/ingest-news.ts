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
//    integral, e a foto de capa NÃO é baixada automaticamente (fica só o ícone
//    da categoria — um admin pode adicionar foto manualmente ao publicar).
//  - Agência Brasil / EBC (nacional) — termos de uso autorizam expressamente
//    "reprodução mediante indicação da fonte", o que cobre também a foto de
//    capa: baixada automaticamente da tag <imagem-destaque> do feed.
//
// Uso: npm run ingest  (ou `tsx scripts/ingest-news.ts`)
//
// Este script roda localmente (Agendador de Tarefas do Windows), mas o site
// no ar é servido pelo Railway — por isso a foto de capa não é escrita direto
// no disco local (o servidor de produção nunca a veria). Em vez disso, o
// script se autentica na própria API pública (mesmas credenciais do /admin,
// via INGEST_ADMIN_EMAIL/INGEST_ADMIN_PASSWORD no .env) e envia a foto pelo
// mesmo endpoint de upload que o painel usa, garantindo que o arquivo fique
// no servidor certo. Sem essas credenciais no .env, a ingestão continua
// funcionando normalmente — só sem foto de capa (fica só o ícone).
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { XMLParser } from 'fast-xml-parser';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const AUTHOR_SLUG = 'redacao';
const ITEMS_PER_SOURCE = 6;

const API_URL = process.env.API_URL ?? 'https://portal-tucuma-api-production.up.railway.app/api';
const INGEST_ADMIN_EMAIL = process.env.INGEST_ADMIN_EMAIL;
const INGEST_ADMIN_PASSWORD = process.env.INGEST_ADMIN_PASSWORD;

const IMAGE_EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — mesmo limite do upload manual no /admin

type FeedSource = {
  name: string;
  url: string;
  feedLabel: string;
  fallbackCategory: string;
  fallbackIcon: string;
  // Fato Regional é "todos os direitos reservados" — por isso o corpo da notícia já
  // usa só resumo + atribuição, nunca o texto integral. Pela mesma razão, não baixamos
  // a foto de capa deles automaticamente (fica só o ícone da categoria; se um admin
  // quiser adicionar uma foto ao publicar, faz isso manualmente). Agência Brasil
  // autoriza expressamente "reprodução mediante indicação da fonte", o que cobre a foto.
  allowImageDownload: boolean;
};

const SOURCES: FeedSource[] = [
  {
    name: 'Fato Regional',
    url: 'https://www.fatoregional.com.br/feed/',
    feedLabel: 'regional',
    fallbackCategory: 'regional',
    fallbackIcon: '📍',
    allowImageDownload: false,
  },
  {
    name: 'Agência Brasil',
    url: 'http://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml',
    feedLabel: 'nacional',
    fallbackCategory: 'brasil',
    fallbackIcon: '🇧🇷',
    allowImageDownload: true,
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
  imageUrl?: string;
};

// Formato bruto do XML parseado — os campos existem "se o feed os trouxer",
// por isso tudo é `unknown`: validamos/convertemos explicitamente abaixo.
type RawFeedItem = {
  title?: unknown;
  link?: unknown;
  pubDate?: unknown;
  description?: unknown;
  category?: unknown;
  'imagem-destaque'?: unknown; // campo próprio da Agência Brasil/EBC com a foto de capa
  enclosure?: unknown; // <enclosure url="..." type="image/..."> — padrão RSS genérico
};
type RawFeed = { rss?: { channel?: { item?: RawFeedItem | RawFeedItem[] } } };

// fast-xml-parser normalmente entrega texto/CDATA como string, mas o tipo é `unknown`
// (schema do feed não é garantido) — números viram string, qualquer outra coisa vira "".
function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

// Extrai a URL da imagem de capa direto do item do feed, quando o feed já
// traz isso (Agência Brasil usa a tag própria <imagem-destaque>; outros
// feeds RSS costumam usar <enclosure url="..." type="image/...">). Nem
// todo feed traz isso — nesses casos cai no fallback do og:image da página.
function extractImageUrl(item: RawFeedItem): string | undefined {
  const destaque = toText(item['imagem-destaque']).trim();
  if (destaque) return destaque;

  const enclosure = item.enclosure as { '@_url'?: unknown; '@_type'?: unknown } | undefined;
  const enclosureType = toText(enclosure?.['@_type']);
  const enclosureUrl = toText(enclosure?.['@_url']).trim();
  if (enclosureUrl && (!enclosureType || enclosureType.startsWith('image/'))) return enclosureUrl;

  return undefined;
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
        imageUrl: extractImageUrl(item),
      };
    });
}

// Fallback pra feeds que não trazem a imagem direto (ex.: Fato Regional): busca a
// própria página da matéria e lê a tag <meta property="og:image">, que o WordPress
// preenche automaticamente com a imagem de destaque do post.
async function fetchOgImage(articleUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalTucumaMilgrauBot/1.0)' },
    });
    if (!res.ok) return undefined;
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    return match?.[1] ? decodeEntities(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

type ImageBuffer = { buffer: Buffer; contentType: string; ext: string };

// Baixa a imagem pra memória (sem gravar em disco local — ver nota de topo do
// arquivo). Qualquer falha (tipo não permitido, arquivo grande demais, rede
// fora) retorna null em vez de quebrar a ingestão do item.
async function fetchImageBuffer(imageUrl: string): Promise<ImageBuffer | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalTucumaMilgrauBot/1.0)' },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type')?.split(';')[0].trim() ?? '';
    const ext = IMAGE_EXT_BY_TYPE[contentType];
    if (!ext) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;

    return { buffer, contentType, ext };
  } catch {
    return null;
  }
}

// Loga no /admin pra obter um token e poder chamar o endpoint de upload de
// capa da própria API pública — mesmo caminho que o painel usa. Sem
// credenciais configuradas, ou se o login falhar, retorna null e a ingestão
// segue sem foto (nunca é motivo pra parar a ingestão de texto).
async function loginForImageUpload(): Promise<string | null> {
  if (!INGEST_ADMIN_EMAIL || !INGEST_ADMIN_PASSWORD) {
    console.log(
      '  ℹ INGEST_ADMIN_EMAIL/INGEST_ADMIN_PASSWORD não configurados no .env — ingestão vai seguir sem foto de capa.',
    );
    return null;
  }
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: INGEST_ADMIN_EMAIL, password: INGEST_ADMIN_PASSWORD }),
    });
    if (!res.ok) {
      console.warn('  ⚠ Login falhou pra upload de foto — ingestão vai seguir sem foto de capa.');
      return null;
    }
    const data = (await res.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    console.warn('  ⚠ Não foi possível logar na API pra upload de foto — ingestão vai seguir sem foto de capa.');
    return null;
  }
}

// Envia a foto pro mesmo endpoint de upload que o painel /admin usa
// (POST /news/admin/:id/cover), garantindo que o arquivo fique salvo no
// servidor de produção (Railway), não no disco da máquina que roda o script.
async function uploadCoverImage(token: string, newsId: string, image: ImageBuffer): Promise<boolean> {
  try {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(image.buffer)], { type: image.contentType }), `capa${image.ext}`);
    const res = await fetch(`${API_URL}/news/admin/${newsId}/cover`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return res.ok;
  } catch {
    return false;
  }
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

async function ingestSource(source: FeedSource, imageToken: string | null) {
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

    const news = await prisma.news.create({
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

    let hasCover = false;
    if (source.allowImageDownload && imageToken) {
      const rawImageUrl = item.imageUrl ?? (await fetchOgImage(item.link));
      const image = rawImageUrl ? await fetchImageBuffer(rawImageUrl) : null;
      hasCover = image ? await uploadCoverImage(imageToken, news.id, image) : false;
    }

    created += 1;
    console.log(`  + [rascunho criado] (${categorySlug}${hasCover ? ', com foto' : ', sem foto'}) ${item.title}`);
  }

  return { created, skipped };
}

async function main() {
  console.log('Ingestão automática de notícias — Portal Tucumã Milgrau');
  console.log(
    'Todas as notícias entram como RASCUNHO. Nada é publicado sem revisão humana no /admin.',
  );

  const imageToken = await loginForImageUpload();

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const source of SOURCES) {
    const { created, skipped } = await ingestSource(source, imageToken);
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
