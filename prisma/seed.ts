// Popula o banco com os mesmos dados fictícios usados no front-end (src/data/news.ts
// do projeto portal-tucuma-nextjs) — útil pra rodar localmente contra um banco vazio.
// NÃO usar em produção: ver scripts/seed-production.ts para o seed real (sem notícias fictícias).
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { slug: "politica", name: "Política", color: "primary" },
  { slug: "policia", name: "Polícia", color: "alert" },
  { slug: "agronegocio", name: "Agronegócio", color: "primary" },
  { slug: "economia", name: "Economia", color: "primary" },
  { slug: "esportes", name: "Esportes", color: "highlight" },
  { slug: "saude", name: "Saúde", color: "primary" },
  { slug: "educacao", name: "Educação", color: "primary" },
  { slug: "tecnologia", name: "Tecnologia", color: "highlight" },
  { slug: "regional", name: "Regional", color: "primary" },
  { slug: "brasil", name: "Brasil", color: "highlight" },
  { slug: "entretenimento", name: "Entretenimento", color: "highlight" },
  { slug: "mundo", name: "Mundo", color: "primary" },
];

const AUTHORS = [
  { slug: "maria-fernandes", name: "Maria Fernandes", initials: "MF", specialty: "Repórter de Política", bio: "Repórter de política há 8 anos, cobre a região sul do Pará." },
  { slug: "roberto-castro", name: "Roberto Castro", initials: "RC", specialty: "Política Regional", bio: "Colunista de política regional do Portal Tucumã Milgrau." },
  { slug: "juliana-lopes", name: "Juliana Lopes", initials: "JL", specialty: "Economia & Agro", bio: "Cobre economia e agronegócio no sul do Pará." },
  { slug: "marcos-pinheiro", name: "Marcos Pinheiro", initials: "MP", specialty: "Segurança Pública", bio: "Colunista de segurança pública." },
  { slug: "ana-souza", name: "Ana Souza", initials: "AS", specialty: "Educação", bio: "Cobre educação e políticas públicas municipais." },
  { slug: "redacao", name: "Redação", initials: "RD", specialty: "Redação Portal Tucumã Milgrau", bio: "Equipe de redação do Portal Tucumã Milgrau." },
];

const NEWS = [
  {
    slug: "duplicacao-pa-279",
    title: "Prefeitura de Tucumã anuncia pacote de investimentos para duplicação da PA-279",
    subtitle: "Obras devem começar em agosto e prometem reduzir em até 40% o tempo de deslocamento entre Tucumã e Ourilândia do Norte.",
    excerpt: "Obras devem começar em agosto e prometem reduzir em até 40% o tempo de deslocamento entre Tucumã e Ourilândia do Norte.",
    body: [
      "A Prefeitura de Tucumã confirmou nesta quarta-feira (23) o pacote de investimentos destinado à duplicação de um trecho de 18 quilômetros da rodovia PA-279, uma das principais vias de escoamento da produção agropecuária do sul do Pará.",
      "Segundo o secretário municipal de Infraestrutura, os recursos somam R$ 42 milhões, sendo parte proveniente de convênio com o Governo do Estado e parte de contrapartida municipal.",
      "\"Essa é a obra mais importante para a mobilidade regional em uma década. Vai encurtar distâncias e salvar vidas\", afirmou o prefeito durante coletiva de imprensa.",
      "O edital de licitação será publicado até o fim de julho, com previsão de início dos trabalhos em agosto de 2026. A conclusão está estimada para o segundo semestre de 2027, em três etapas.",
      "Especialistas estimam que a obra pode reduzir em até 40% o tempo de deslocamento entre Tucumã e Ourilândia do Norte, favorecendo o escoamento agrícola e o transporte de passageiros na região.",
      "Moradores e associações comerciais locais receberam a notícia com otimismo, apontando que a rodovia é hoje um dos principais gargalos logísticos da região.",
      "A Prefeitura informou que reuniões públicas serão realizadas nos próximos meses para apresentar o projeto executivo à população.",
    ].join("\n\n"),
    coverIcon: "🚧",
    readTimeMin: 6,
    views: 12400,
    categorySlug: "politica",
    authorSlug: "maria-fernandes",
  },
  {
    slug: "camara-orcamento-2027",
    title: "Câmara de Tucumã aprova orçamento de R$ 180 milhões para 2027",
    subtitle: "",
    excerpt: "Proposta prevê investimentos prioritários em saúde, educação e infraestrutura viária.",
    body: "Proposta prevê investimentos prioritários em saúde, educação e infraestrutura viária.\n\nA votação ocorreu por unanimidade em sessão realizada nesta semana na Câmara Municipal.",
    coverIcon: "🏛️",
    readTimeMin: 5,
    views: 9200,
    categorySlug: "politica",
    authorSlug: "roberto-castro",
  },
  {
    slug: "pm-apreende-motocicleta",
    title: "PM apreende motocicleta com sinais de adulteração em blitz na PA-279",
    subtitle: "",
    excerpt: "Ação faz parte da Operação Rodovida, que reforça a fiscalização nas rodovias da região.",
    body: "Ação faz parte da Operação Rodovida, que reforça a fiscalização nas rodovias da região.\n\nNinguém foi preso; o veículo foi encaminhado para perícia.",
    coverIcon: "🚔",
    readTimeMin: 3,
    views: 7800,
    categorySlug: "policia",
    authorSlug: "marcos-pinheiro",
  },
  {
    slug: "safra-milho-recorde",
    title: "Safra de milho supera expectativas no sul do Pará em 2026",
    subtitle: "",
    excerpt: "Produtores comemoram alta de 18% na produtividade média por hectare na região.",
    body: "Produtores comemoram alta de 18% na produtividade média por hectare na região.\n\nO resultado é atribuído ao regime de chuvas favorável e à adoção de novas técnicas de manejo.",
    coverIcon: "🌾",
    readTimeMin: 4,
    views: 6100,
    categorySlug: "agronegocio",
    authorSlug: "juliana-lopes",
  },
  {
    slug: "comercio-local-cresce",
    title: "Comércio local registra crescimento de 12% no primeiro semestre",
    subtitle: "",
    excerpt: "Associação comercial de Tucumã aponta recuperação puxada pelo setor de serviços.",
    body: "Associação comercial de Tucumã aponta recuperação puxada pelo setor de serviços.\n\nO levantamento considerou dados de mais de 200 estabelecimentos associados.",
    coverIcon: "💰",
    readTimeMin: 6,
    views: 5400,
    categorySlug: "economia",
    authorSlug: "juliana-lopes",
  },
  {
    slug: "selecao-tucuma-sub17",
    title: "Seleção de Tucumã se prepara para Copa Regional Sub-17",
    subtitle: "",
    excerpt: "Equipe realiza treinos intensivos visando a estreia na competição no mês que vem.",
    body: "Equipe realiza treinos intensivos visando a estreia na competição no mês que vem.\n\nOs jogos de abertura acontecem no Estádio Municipal.",
    coverIcon: "⚽",
    readTimeMin: 3,
    views: 4900,
    categorySlug: "esportes",
    authorSlug: "redacao",
  },
  {
    slug: "hospital-nova-ala",
    title: "Hospital Municipal amplia atendimento com nova ala de urgência",
    subtitle: "",
    excerpt: "Unidade passa a contar com 12 novos leitos e equipe multidisciplinar reforçada.",
    body: "Unidade passa a contar com 12 novos leitos e equipe multidisciplinar reforçada.\n\nA expansão faz parte do plano municipal de saúde para 2026.",
    coverIcon: "🏥",
    readTimeMin: 5,
    views: 4200,
    categorySlug: "saude",
    authorSlug: "ana-souza",
  },
  {
    slug: "material-didatico-regional",
    title: "Rede municipal de ensino adota material didático regionalizado",
    subtitle: "",
    excerpt: "Iniciativa busca aproximar o conteúdo escolar da realidade da Amazônia paraense.",
    body: "Iniciativa busca aproximar o conteúdo escolar da realidade da Amazônia paraense.\n\nO material foi desenvolvido em parceria com universidades da região.",
    coverIcon: "🎓",
    readTimeMin: 4,
    views: 3700,
    categorySlug: "educacao",
    authorSlug: "ana-souza",
  },
  {
    slug: "hackathon-sul-para",
    title: "Tucumã sedia primeiro hackathon de inovação do sul do Pará",
    subtitle: "",
    excerpt: "Evento reúne desenvolvedores locais para criar soluções voltadas ao agronegócio.",
    body: "Evento reúne desenvolvedores locais para criar soluções voltadas ao agronegócio.\n\nAs equipes vencedoras recebem mentoria e apoio para prototipagem.",
    coverIcon: "💻",
    readTimeMin: 3,
    views: 3100,
    categorySlug: "tecnologia",
    authorSlug: "redacao",
  },
];

const COMMENTS: Record<string, { authorName: string; text: string; likes: number }[]> = {
  "duplicacao-pa-279": [
    { authorName: "João Silva", text: "Excelente notícia! Essa rodovia precisa dessa melhoria urgente, uso todos os dias.", likes: 14 },
    { authorName: "Patrícia Carvalho", text: "Espero que o prazo seja cumprido dessa vez. Vamos acompanhar de perto.", likes: 7 },
  ],
};

const ADMIN_EMAIL = "admin@tucumamilgrau.com.br";
const ADMIN_PASSWORD = "admin123";

async function main() {
  console.log("Semeando usuário administrador...");
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: {
      name: "Administrador Portal Tucumã Milgrau",
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      city: "Tucumã",
    },
  });
  console.log(`  → login: ${ADMIN_EMAIL} / senha: ${ADMIN_PASSWORD} (troque depois do primeiro acesso)`);

  console.log("Limpando dados existentes...");
  await prisma.comment.deleteMany();
  await prisma.news.deleteMany();
  await prisma.author.deleteMany();
  await prisma.category.deleteMany();

  console.log("Semeando categorias...");
  const categoryBySlug = new Map<string, string>();
  for (const c of CATEGORIES) {
    const created = await prisma.category.create({ data: c });
    categoryBySlug.set(c.slug, created.id);
  }

  console.log("Semeando autores...");
  const authorBySlug = new Map<string, string>();
  for (const a of AUTHORS) {
    const created = await prisma.author.create({ data: a });
    authorBySlug.set(a.slug, created.id);
  }

  console.log("Semeando notícias...");
  for (const n of NEWS) {
    const created = await prisma.news.create({
      data: {
        slug: n.slug,
        title: n.title,
        subtitle: n.subtitle,
        excerpt: n.excerpt,
        body: n.body,
        coverIcon: n.coverIcon,
        readTimeMin: n.readTimeMin,
        views: n.views,
        status: "PUBLISHED",
        categoryId: categoryBySlug.get(n.categorySlug)!,
        authorId: authorBySlug.get(n.authorSlug)!,
      },
    });

    const comments = COMMENTS[n.slug] ?? [];
    for (const c of comments) {
      await prisma.comment.create({ data: { ...c, newsId: created.id } });
    }
  }

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
