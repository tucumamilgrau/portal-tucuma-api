import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(
        `Já existe uma categoria com o slug "${dto.slug}"`,
      );
    return this.prisma.category.create({ data: dto });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Categoria não encontrada');

    if (dto.slug && dto.slug !== existing.slug) {
      const clash = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });
      if (clash)
        throw new ConflictException(
          `Já existe uma categoria com o slug "${dto.slug}"`,
        );
    }

    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { news: true } } },
    });
    if (!existing) throw new NotFoundException('Categoria não encontrada');
    if (existing._count.news > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${existing._count.news} notícia(s) usam esta categoria. Mova-as para outra categoria antes.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    return { id };
  }
}
