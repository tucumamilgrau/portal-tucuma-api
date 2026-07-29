import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ModerationService } from '../comments/moderation.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

const LIST_CACHE_PREFIX = 'news:list';
const MOST_READ_CACHE_KEY = 'news:most-read';
const FEATURED_CACHE_KEY = 'news:featured';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly moderation: ModerationService,
  ) {}

  private readonly include = {
    category: true,
    author: true,
  } as const;

  async findAll(categorySlug?: string, limit = 20) {
    const cacheKey = `${LIST_CACHE_PREFIX}:${categorySlug ?? 'all'}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const news = await this.prisma.news.findMany({
      where: {
        status: 'PUBLISHED',
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      include: this.include,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    this.cache.set(cacheKey, news, 30);
    return news;
  }

  async findMostRead(limit = 7) {
    const cached = this.cache.get(MOST_READ_CACHE_KEY);
    if (cached) return cached;

    const news = await this.prisma.news.findMany({
      where: { status: 'PUBLISHED' },
      include: this.include,
      orderBy: { views: 'desc' },
      take: limit,
    });

    this.cache.set(MOST_READ_CACHE_KEY, news, 30);
    return news;
  }

  /** Slider "Notícias em Destaque" da home — só as marcadas featured=true no /admin. */
  async findFeatured(limit = 5) {
    const cached = this.cache.get(FEATURED_CACHE_KEY);
    if (cached) return cached;

    const news = await this.prisma.news.findMany({
      where: { status: 'PUBLISHED', featured: true },
      include: this.include,
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    this.cache.set(FEATURED_CACHE_KEY, news, 30);
    return news;
  }

  /** Só para o painel administrativo: lista TODAS as notícias, incluindo rascunhos/agendadas. */
  async findAllForAdmin() {
    return this.prisma.news.findMany({
      include: this.include,
      orderBy: { publishedAt: 'desc' },
    });
  }

  /** Estatísticas reais (Dashboard/Estatísticas do painel) — nada de números mock. */
  async getStats() {
    const [
      totalViewsAgg,
      statusCounts,
      categoryAgg,
      categories,
      recentPublished,
    ] = await Promise.all([
      this.prisma.news.aggregate({
        where: { status: 'PUBLISHED' },
        _sum: { views: true },
      }),
      this.prisma.news.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.news.groupBy({
        by: ['categoryId'],
        where: { status: 'PUBLISHED' },
        _sum: { views: true },
      }),
      this.prisma.category.findMany(),
      this.prisma.news.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        select: { publishedAt: true },
      }),
    ]);

    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const viewsByCategory = categoryAgg
      .map((c) => ({
        category: categoryNameById.get(c.categoryId) ?? 'Desconhecida',
        views: c._sum.views ?? 0,
      }))
      .sort((a, b) => b.views - a.views);

    const dayBuckets = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const n of recentPublished) {
      const key = n.publishedAt.toISOString().slice(0, 10);
      if (dayBuckets.has(key))
        dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    }

    const byStatus = { DRAFT: 0, SCHEDULED: 0, PUBLISHED: 0 };
    for (const s of statusCounts) byStatus[s.status] = s._count._all;

    return {
      totalViews: totalViewsAgg._sum.views ?? 0,
      byStatus,
      viewsByCategory,
      publishedLast7Days: Array.from(dayBuckets.entries()).map(
        ([date, count]) => ({ date, count }),
      ),
    };
  }

  async findBySlug(slug: string) {
    const news = await this.prisma.news.findUnique({
      where: { slug },
      include: {
        ...this.include,
        comments: { where: { approved: true }, orderBy: { createdAt: 'desc' } },
      },
    });
    // Rascunhos/agendadas não ficam visíveis publicamente, mesmo sabendo o slug.
    if (!news || news.status !== 'PUBLISHED') {
      throw new NotFoundException(`Notícia "${slug}" não encontrada`);
    }

    // Cada carregamento da página do artigo conta como uma visualização. Contador
    // simples (sem deduplicação por sessão/IP), no mesmo nível de sofisticação do
    // resto do projeto — alimenta "Mais Lidas", o dashboard e as estatísticas.
    news.views += 1;
    await this.prisma.news.update({
      where: { id: news.id },
      data: { views: { increment: 1 } },
    });
    this.cache.del(MOST_READ_CACHE_KEY);

    const related = await this.prisma.news.findMany({
      where: {
        categoryId: news.categoryId,
        id: { not: news.id },
        status: 'PUBLISHED',
      },
      include: this.include,
      orderBy: { publishedAt: 'desc' },
      take: 3,
    });

    return { ...news, related };
  }

  /** Para o painel administrativo editar: busca por id, sem filtrar por status. */
  async findByIdForAdmin(id: string) {
    const news = await this.prisma.news.findUnique({
      where: { id },
      include: this.include,
    });
    if (!news) throw new NotFoundException('Notícia não encontrada');
    return news;
  }

  async addComment(slug: string, dto: CreateCommentDto) {
    const news = await this.prisma.news.findUnique({ where: { slug } });
    if (!news) throw new NotFoundException(`Notícia "${slug}" não encontrada`);

    // Filtro heurístico (ver ModerationService): comentários sinalizados nascem
    // não aprovados e ficam na fila de revisão em vez de ir direto ao ar.
    const { flagged } = await this.moderation.classify(
      `${dto.authorName} ${dto.text}`,
    );

    return this.prisma.comment.create({
      data: {
        newsId: news.id,
        authorName: dto.authorName,
        text: dto.text,
        flagged,
        approved: !flagged,
      },
    });
  }

  async create(dto: CreateNewsDto) {
    const category = await this.prisma.category.findUnique({
      where: { slug: dto.categorySlug },
    });
    if (!category)
      throw new BadRequestException(
        `Categoria "${dto.categorySlug}" não existe`,
      );

    const author = await this.prisma.author.findUnique({
      where: { slug: dto.authorSlug },
    });
    if (!author)
      throw new BadRequestException(`Autor "${dto.authorSlug}" não existe`);

    const slug = await this.generateUniqueSlug(dto.title);

    const news = await this.prisma.news.create({
      data: {
        slug,
        title: dto.title,
        subtitle: dto.subtitle ?? '',
        excerpt: dto.excerpt,
        body: dto.body ?? '',
        coverIcon: dto.coverIcon ?? '📰',
        readTimeMin: dto.readTimeMin ?? 4,
        status: dto.status ?? 'PUBLISHED',
        featured: dto.featured ?? false,
        videoUrl: dto.videoUrl,
        categoryId: category.id,
        authorId: author.id,
      },
      include: this.include,
    });

    this.invalidateListCaches();
    return news;
  }

  async update(id: string, dto: UpdateNewsDto) {
    const existing = await this.prisma.news.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notícia não encontrada');

    let categoryId: string | undefined;
    if (dto.categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: dto.categorySlug },
      });
      if (!category)
        throw new BadRequestException(
          `Categoria "${dto.categorySlug}" não existe`,
        );
      categoryId = category.id;
    }

    let authorId: string | undefined;
    if (dto.authorSlug) {
      const author = await this.prisma.author.findUnique({
        where: { slug: dto.authorSlug },
      });
      if (!author)
        throw new BadRequestException(`Autor "${dto.authorSlug}" não existe`);
      authorId = author.id;
    }

    // A ordem cronológica do portal é por publishedAt. Uma notícia só "nasce" publicada
    // no momento em que passa a ter status PUBLISHED — se ela estava em rascunho/agendada
    // e só agora está sendo publicada, o publishedAt precisa refletir esse instante, não o
    // momento em que o rascunho foi criado.
    const isBeingPublishedNow =
      dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED';

    const news = await this.prisma.news.update({
      where: { id },
      data: {
        title: dto.title,
        subtitle: dto.subtitle,
        excerpt: dto.excerpt,
        body: dto.body,
        coverIcon: dto.coverIcon,
        coverImage: dto.coverImage,
        readTimeMin: dto.readTimeMin,
        status: dto.status,
        featured: dto.featured,
        videoUrl: dto.videoUrl,
        categoryId,
        authorId,
        ...(isBeingPublishedNow ? { publishedAt: new Date() } : {}),
      },
      include: this.include,
    });

    this.invalidateListCaches();
    return news;
  }

  async setCoverImage(id: string, url: string | null) {
    const existing = await this.prisma.news.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notícia não encontrada');

    const news = await this.prisma.news.update({
      where: { id },
      data: { coverImage: url },
      include: this.include,
    });

    this.invalidateListCaches();
    return news;
  }

  async remove(id: string) {
    const existing = await this.prisma.news.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Notícia não encontrada');

    await this.prisma.news.delete({ where: { id } });
    this.invalidateListCaches();
    return { id };
  }

  private invalidateListCaches() {
    this.cache.invalidatePrefix(LIST_CACHE_PREFIX);
    this.cache.del(MOST_READ_CACHE_KEY);
    this.cache.del(FEATURED_CACHE_KEY);
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'noticia';
    let slug = base;
    let suffix = 2;
    while (await this.prisma.news.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }
}
