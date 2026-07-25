# Portal Tucumã Milgrau — API

API REST em **NestJS + Prisma 7**, substituindo os dados mock (`src/data/news.ts`) do front-end Next.js por endpoints reais, com banco de dados e cache.

## Stack e por que essas escolhas

| Camada | Usado aqui | Motivo |
|---|---|---|
| Framework | NestJS 11 | pedido no roadmap original |
| ORM | Prisma 7 | pedido no roadmap original (via PostgreSQL) |
| Banco | **PostgreSQL** (Railway em produção; mesmo banco usado em dev local) | Pedido no roadmap original. |
| Cache | **Serviço em memória** (`src/cache/cache.service.ts`) | Não há Docker/Redis disponível. Interface pensada para ser trocada por `ioredis` sem mexer em quem consome o cache. |
| Validação | class-validator + class-transformer | DTOs com `ValidationPipe` global |

## Como rodar

```bash
npm install
# defina DATABASE_URL no .env apontando para um Postgres (ver .env.example)
npx prisma migrate deploy   # aplica as migrações no banco
npx prisma db seed          # popula com os mesmos dados mock do front-end (uso local/dev)
npm run start:dev
```

API sobe em **http://localhost:3001/api**. CORS liberado para qualquer origem (adequado para desenvolvimento local; restrinja em produção).

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/news` | Lista notícias publicadas. Query params: `category` (slug), `limit` |
| GET | `/api/news/most-read` | Top notícias por visualizações. Query: `limit` |
| GET | `/api/news/:slug` | Notícia completa: categoria, autor, comentários e relacionadas |
| POST | `/api/news/:slug/comments` | Cria comentário. Body: `{ authorName, text }` |
| GET | `/api/categories` | Lista categorias |
| GET | `/api/authors` | Lista autores/colunistas |
| GET | `/api/authors/:slug` | Autor específico |
| POST | `/api/auth/register` | Cria conta. Body: `{ name, email, password, city? }` → `{ token, user }` |
| POST | `/api/auth/login` | Login. Body: `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | Dados do usuário logado. Requer header `Authorization: Bearer <token>` |
| GET | `/api/news/admin` | **Admin.** Lista TODAS as notícias (inclusive rascunho/agendada) |
| GET | `/api/news/admin/:id` | **Admin.** Notícia por id, sem filtrar status (para pré-preencher o form de edição) |
| POST | `/api/news` | **Admin.** Cria notícia. Body: `{ title, excerpt, categorySlug, authorSlug, subtitle?, body?, coverIcon?, readTimeMin?, status? }` — slug gerado automaticamente a partir do título |
| PATCH | `/api/news/admin/:id` | **Admin.** Edita notícia (todos os campos acima, opcionais) |
| POST | `/api/news/admin/:id/cover` | **Admin.** Upload da foto de capa. `multipart/form-data`, campo `file` (JPEG/PNG/WebP/GIF, até 8MB) |
| DELETE | `/api/news/admin/:id/cover` | **Admin.** Remove a foto de capa (volta a usar o `coverIcon`) |
| DELETE | `/api/news/admin/:id` | **Admin.** Exclui notícia (comentários são apagados em cascata) |
| GET | `/api/news/admin/stats` | **Admin.** Estatísticas reais: views totais, contagem por status, views por categoria, publicações dos últimos 7 dias |
| GET | `/api/news/featured` | Notícias publicadas marcadas com `featured: true` (slider "Notícias em Destaque" da home), ordenadas por `publishedAt` |
| GET/POST/PATCH/DELETE | `/api/classifieds`, `/api/classifieds/admin`, `/api/classifieds/:id` | `GET /classifieds?category=` público (só `active: true`); resto **admin** — CRUD de classificados (`category`: Imóveis/Veículos/Empregos/Serviços) |
| GET/POST/PATCH/DELETE | `/api/categories`, `/api/categories/:id` | GET público; POST/PATCH/DELETE **admin** — CRUD de categorias (bloqueia exclusão se houver notícias usando a categoria) |
| GET/POST/PATCH/DELETE | `/api/authors`, `/api/authors/:id` | GET público (`:slug` para leitura, `:id` para admin); POST/PATCH/DELETE **admin** — CRUD de autores |
| GET/POST/DELETE | `/api/media`, `/api/media/upload`, `/api/media/:filename` | **Admin.** Biblioteca de mídia genérica: lista/upload/exclui arquivos em `uploads/media/` |
| GET/POST/PATCH/DELETE | `/api/ads`, `/api/ads/admin`, `/api/ads/:id` | `GET /ads?slot=` público (anúncio ativo do espaço); resto **admin** — CRUD de anúncios (`slot`, período de veiculação, ativo/inativo) |
| GET/PATCH/DELETE | `/api/comments/admin`, `/api/comments/admin/:id` | **Admin.** Lista/aprova-reprova/exclui comentários. Query `filter=all\|pending\|flagged` |
| POST | `/api/comments/:id/report` | Público — leitor denuncia um comentário (marca `flagged`, incrementa `reportCount`) |
| GET/PATCH | `/api/moderation/settings` | **Admin.** Liga/desliga e configura a lista de termos do filtro heurístico de comentários |
| GET | `/api/moderation/stats` | **Admin.** Quantos comentários foram analisados/sinalizados/ficaram pendentes |
| GET/PATCH/DELETE | `/api/auth/admin/users`, `/api/auth/admin/users/:id/role`, `/api/auth/admin/users/:id` | **Admin.** Lista usuários, muda papel (READER/ADMIN), exclui conta — bloqueia auto-alteração e remoção do último admin |
| PATCH | `/api/auth/change-password` | Autenticado (qualquer usuário) — troca a própria senha, valida a senha atual |

A listagem (`/news` e `/news/most-read`) é cacheada em memória por 30s; qualquer create/update/delete invalida o cache na hora.

## Painel administrativo completo

Todo item do menu lateral do `/admin` (Next.js) tem uma tela real por trás — nada de link morto:

- **Categorias / Autores**: CRUD completo (`src/categories`, `src/authors`). Exclusão é bloqueada com mensagem amigável se a categoria/autor ainda tiver notícias vinculadas.
- **Mídia** (`src/media`): biblioteca de imagens independente do upload de capa de notícia — envia para `uploads/media/`, lista com preview, copia URL, exclui. Nome de arquivo sempre `randomUUID()+extensão` (protege contra path traversal na exclusão).
- **Estatísticas** (`GET /news/admin/stats`): agregações reais via Prisma (`aggregate`/`groupBy`) — nada de números mock. Alimenta tanto o Dashboard quanto a tela de Estatísticas.
- **Notícias em Destaque**: campo `News.featured` (checkbox "⭐ Destaque" no form de notícia). `GET /news/featured` devolve só publicadas + destacadas, mais recentes primeiro — alimenta o slider da home. Sem nenhuma marcada, a seção some da home (sem fallback fake).
- **Classificados** (`src/classifieds`, model `Classified`): CRUD completo (título, categoria, preço, descrição, ícone/foto, ativo/inativo) em `/admin/classificados`. `GET /classifieds` é público e filtra só `active: true`; a home mostra só anúncios reais — sem nenhum cadastrado, aparece um estado vazio honesto em vez de conteúdo fictício.
- **SEO**: sem endpoint próprio — a tela do painel busca as notícias reais (`/news/admin`) e roda um checklist no front-end (título muito curto/longo, sem resumo, sem foto de capa, sem subtítulo).
- **Publicidade** (`src/ads`, model `Advertisement`): CRUD de anúncios por `slot` (`sidebar`, `article-sidebar`, `footer-banner`), com período de veiculação opcional (`startsAt`/`endsAt`). `GET /ads?slot=` é público e devolve o anúncio ativo daquele espaço (ou `null` — o front cai no placeholder decorativo). Sem anúncios cadastrados, o site continua funcionando normalmente com os placeholders.
- **Comentários / Denúncias / Inteligência Artificial** (`src/comments`): um filtro heurístico local (**não é um modelo de IA/LLM**) roda em todo comentário novo (`ModerationService.classify`), comparando contra uma lista de termos configurável (`ModerationSettings`, linha única no banco) e alguns padrões de spam (texto todo em maiúsculas, caractere repetido em excesso). Comentário sinalizado nasce com `approved: false, flagged: true` e fica pendente — não aparece publicamente até um admin aprovar em `/admin/comentarios`. Leitores podem denunciar qualquer comentário publicado (`POST /comments/:id/report`), o que também marca `flagged: true` e incrementa `reportCount`; esses casos aparecem em `/admin/denuncias`.
- **Usuários**: papel (`READER`/`ADMIN`) e exclusão de conta, com duas proteções em `auth.service.ts`: um admin não pode alterar/excluir a própria conta por essa tela, e não é possível remover o último `ADMIN` do sistema.
- **Segurança**: troca de senha (`PATCH /auth/change-password`) valida a senha atual antes de trocar — útil especialmente para trocar a senha padrão do admin semeado (`admin123`) fora do ambiente de desenvolvimento.

## Ordem cronológica e fotos de capa

- **`publishedAt`** só é atualizado para "agora" no momento em que o status realmente vira `PUBLISHED` pela primeira vez (transição de DRAFT/SCHEDULED → PUBLISHED). Editar uma notícia já publicada (texto, foto etc.) não mexe na data — ela não "pula" para o topo da lista por engano. Toda notícia publicada continua armazenada indefinidamente (exclusão é sempre manual, pelo botão 🗑️).
- **Fotos de capa** sobem via `multer` com `diskStorage` para `uploads/news/` (nomes únicos via UUID) e são servidas estaticamente em `/uploads/news/...` (fora do prefixo `/api`, configurado em `main.ts` com `app.useStaticAssets`). O campo `coverImage` no model `News` guarda esse caminho relativo; quando `null`, o front-end usa o `coverIcon` (emoji) ou a imagem padrão da categoria como fallback.
- **Produção**: a pasta `uploads/` é conteúdo dinâmico gerado em runtime — não é para commitar no git (adicione ao `.gitignore`) nem serve bem em hospedagem serverless/imutável (Vercel, por exemplo). Em um VPS/Railway/Render com disco persistente funciona normalmente; para algo mais robusto, trocar o `diskStorage` por upload direto a um bucket S3/R2 é o próximo passo natural.

## Autenticação e administração

JWT simples (sem Passport — um `JwtAuthGuard` próprio lê o header `Authorization`, valida com `@nestjs/jwt` e injeta `req.user`). Senhas com hash via `bcryptjs` (não `bcrypt`: este último precisa compilar binário nativo via `node-gyp`, que falha nesta máquina sem Visual Studio Build Tools — mesmo problema do `better-sqlite3`, ver abaixo).

- Segredo do token em `JWT_SECRET` (`.env`) — troque em produção; há um valor padrão de desenvolvimento como fallback.
- Token expira em 7 dias (`signOptions.expiresIn` em `src/auth/auth.module.ts`).
- Login social (Google/Facebook) fica fora do escopo — exigiria criar apps OAuth nesses provedores.
- Endpoints de notícias/comentários continuam públicos (não exigem login) — só `/auth/me` e as rotas administrativas usam guard.
- **Papéis**: `User.role` é `READER` (padrão) ou `ADMIN`. As rotas de gestão de notícias (`POST/PATCH/DELETE /news...` e `GET /news/admin...`) usam `AdminGuard`, que exige token válido **e** `role: 'ADMIN'` no payload (senão retorna 403). Um usuário `READER` autenticado não consegue publicar/editar/excluir.
- **Conta de administrador padrão** (criada pelo seed):
  ```
  E-mail: admin@tucumamilgrau.com.br
  Senha:  admin123
  ```
  Troque essa senha em qualquer ambiente que não seja seu localhost de desenvolvimento — ela está em texto plano no `prisma/seed.ts`.

## Schema (`prisma/schema.prisma`)

`Category`, `Author`, `News` (com `status`: DRAFT/SCHEDULED/PUBLISHED) e `Comment`, espelhando exatamente o que o front-end (`portal-tucuma-nextjs/src/data/news.ts`) já usava como mock. O seed (`prisma/seed.ts`) povoa o banco com os mesmos textos que estavam no mock, então a migração para quem usa o front-end é transparente.

## Seed em produção

`prisma/seed.ts` (rodado via `npx prisma db seed`) povoa o banco com os mesmos dados fictícios usados no mock do front-end — **não usar em produção**. Para popular um banco de produção (Railway), use `scripts/seed-production.ts`, que cria apenas a estrutura real (usuário admin, categorias, autor "Redação") sem nenhuma notícia fictícia:

```bash
DATABASE_URL="postgresql://..." npx tsx scripts/seed-production.ts
```

Notícias reais entram depois, publicadas pelo `/admin` ou importadas pelo ingestor RSS (`npm run ingest`).

## Trocando o cache em memória por Redis real

`src/cache/cache.service.ts` tem `get`/`set`/`del`/`invalidatePrefix` — a mesma forma de uso de um wrapper simples sobre `ioredis`. Para trocar: instale `ioredis`, reimplemente os métodos usando um client Redis real, e o resto da API (que só injeta `CacheService`) não muda.

## Notas específicas do Prisma 7 (bem recente — cuidado se for mexer)

- **Config não fica mais implícita no `schema.prisma`.** Vive em `prisma.config.ts`.
- **Client é ESM por padrão.** Isso quebrava o build do Nest (`ReferenceError: exports is not defined`) porque o Nest compila para CommonJS. Solução: `moduleFormat = "cjs"` no bloco `generator client` do schema.
- **`PrismaClient` agora exige um *driver adapter*** (`new PrismaClient({ adapter })`) — não basta mais só a `DATABASE_URL`. Aqui usamos `@prisma/adapter-pg`.
- Seed roda via `tsx` (não `ts-node`) — mistura melhor com o client ESM/CJS do Prisma 7.
- Documentação completa ficou instalada em `.agents/skills/` pelo próprio `prisma init` — útil para qualquer dúvida futura sobre esta versão.

## Ingestão automática de notícias (regional + nacional)

`scripts/ingest-news.ts` (`npm run ingest`) busca os feeds RSS de duas fontes autorizadas e cria uma notícia em **rascunho** (`status: DRAFT`) para cada item novo. **Nunca publica sozinho** — um administrador humano revisa e publica pelo painel (`/admin`), evitando que algo incorreto, desatualizado ou fora do padrão editorial vá ao ar sem revisão.

- **Fato Regional** (`https://www.fatoregional.com.br/feed/`) — cobre exatamente a região do portal (Tucumã, Parauapebas, São Félix do Xingu, Xinguara). O conteúdo é "todos os direitos reservados", então o rascunho usa só o resumo curto que o próprio feed já traz (não o texto integral) + parágrafo de atribuição com link para a matéria original.
- **Agência Brasil / EBC** (`http://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml`) — cobertura nacional. Os termos de uso da EBC autorizam expressamente "reprodução mediante indicação da fonte", então o texto do feed é usado integralmente, sempre com o parágrafo de atribuição ao final.

Cada notícia importada grava `sourceUrl` (usado para deduplicar — rodar o script de novo não duplica itens já importados) e `sourceName`; o front-end mostra um aviso "🔗 Conteúdo original de [Fonte]" na página do artigo, e o painel admin mostra uma etiqueta 🔗 na lista para o editor identificar rascunhos importados. Categoria é inferida por palavras-chave nas tags do feed (política, polícia, agronegócio, economia, esportes, saúde, educação, tecnologia); sem correspondência, cai em `regional` (Fato Regional) ou `brasil` (Agência Brasil) — categorias criadas especificamente para isso no seed.

**Execução automática diária**: uma tarefa no Agendador de Tarefas do Windows (`PortalTucumaMilgrau_IngestNoticias`, rodando `scripts/run-ingest.bat` todo dia às 07:15) chama `npm run ingest` direto no banco (não depende do servidor Nest estar rodando). Log em `logs/ingest.log`. Para alterar horário/frequência: `schtasks /change /tn PortalTucumaMilgrau_IngestNoticias /st HH:MM`. Para remover: `schtasks /delete /tn PortalTucumaMilgrau_IngestNoticias /f`. Isso é uma automação local (roda só enquanto este PC estiver ligado); em produção, o equivalente seria um cron job no servidor.

## O que ainda falta (fora do escopo desta etapa)

- Eventos, clima, enquete, vídeos, podcasts, classificados: continuam mock no front-end; não fazem parte deste schema.
- Testes automatizados (`*.spec.ts`) — o Nest já vem com a estrutura, mas não escrevi testes para os módulos novos (incluindo `auth`, `news`, `categories`, `authors`, `media`, `ads`, `comments`).
- Login social (Google/Facebook) — precisa de apps OAuth registrados nesses provedores.
- Recuperação de senha ("Esqueci a senha" no front-end é só visual ainda — a troca de senha autenticada existe em `/admin/seguranca`).
- Gestão de colunistas com perfil completo (foto, bio longa) continua fora do schema — só o essencial de `Author` (nome, iniciais, especialidade, bio curta) tem CRUD.
