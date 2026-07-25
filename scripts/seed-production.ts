// Seed real de produção — roda uma vez contra o Postgres do Railway.
// Cria apenas a estrutura base (usuário admin + categorias + autor "Redação"),
// sem nenhuma notícia fictícia: as notícias reais entram via ingestor RSS
// (scripts/ingest-news.ts) ou publicadas manualmente no /admin.
//
// Uso: DATABASE_URL="postgresql://..." npx tsx scripts/seed-production.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { slug: 'politica', name: 'Política', color: 'primary' },
  { slug: 'policia', name: 'Polícia', color: 'alert' },
  { slug: 'agronegocio', name: 'Agronegócio', color: 'primary' },
  { slug: 'economia', name: 'Economia', color: 'primary' },
  { slug: 'esportes', name: 'Esportes', color: 'highlight' },
  { slug: 'saude', name: 'Saúde', color: 'primary' },
  { slug: 'educacao', name: 'Educação', color: 'primary' },
  { slug: 'tecnologia', name: 'Tecnologia', color: 'highlight' },
  { slug: 'regional', name: 'Regional', color: 'primary' },
  { slug: 'brasil', name: 'Brasil', color: 'highlight' },
  { slug: 'entretenimento', name: 'Entretenimento', color: 'highlight' },
  { slug: 'mundo', name: 'Mundo', color: 'primary' },
];

const AUTHORS = [
  {
    slug: 'redacao',
    name: 'Redação',
    initials: 'RD',
    specialty: 'Redação Portal Tucumã Milgrau',
    bio: 'Equipe de redação do Portal Tucumã Milgrau.',
  },
];

const ADMIN_EMAIL = 'admin@tucumamilgrau.com.br';
const ADMIN_PASSWORD = 'admin123';

async function main() {
  console.log('Semeando usuário administrador...');
  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN' },
    create: {
      name: 'Administrador Portal Tucumã Milgrau',
      email: ADMIN_EMAIL,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      city: 'Tucumã',
    },
  });
  console.log(
    `  → login: ${ADMIN_EMAIL} / senha: ${ADMIN_PASSWORD} (troque essa senha assim que acessar o /admin)`,
  );

  console.log('Semeando categorias...');
  for (const c of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, color: c.color },
      create: c,
    });
  }

  console.log('Semeando autor "Redação"...');
  for (const a of AUTHORS) {
    await prisma.author.upsert({
      where: { slug: a.slug },
      update: a,
      create: a,
    });
  }

  console.log(
    '\nSeed de produção concluído. Nenhuma notícia fictícia foi criada — ' +
      'publique notícias reais pelo /admin ou rode o ingestor RSS (npm run ingest).',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
