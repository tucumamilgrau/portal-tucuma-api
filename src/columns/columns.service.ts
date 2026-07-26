import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateColumnDto } from './dto/create-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';

@Injectable()
export class ColumnsService {
  private readonly include = { author: true } as const;

  constructor(private readonly prisma: PrismaService) {}

  findAllActive(limit = 4) {
    return this.prisma.column.findMany({
      where: { status: 'PUBLISHED' },
      include: this.include,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  findAllForAdmin() {
    return this.prisma.column.findMany({
      include: this.include,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateColumnDto) {
    const author = await this.prisma.author.findUnique({
      where: { slug: dto.authorSlug },
    });
    if (!author) throw new BadRequestException(`Autor "${dto.authorSlug}" não existe`);

    return this.prisma.column.create({
      data: {
        title: dto.title,
        excerpt: dto.excerpt ?? '',
        status: dto.status ?? 'PUBLISHED',
        authorId: author.id,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateColumnDto) {
    const existing = await this.prisma.column.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coluna não encontrada');

    let authorId: string | undefined;
    if (dto.authorSlug) {
      const author = await this.prisma.author.findUnique({
        where: { slug: dto.authorSlug },
      });
      if (!author) throw new BadRequestException(`Autor "${dto.authorSlug}" não existe`);
      authorId = author.id;
    }

    return this.prisma.column.update({
      where: { id },
      data: {
        title: dto.title,
        excerpt: dto.excerpt,
        status: dto.status,
        authorId,
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.column.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coluna não encontrada');
    await this.prisma.column.delete({ where: { id } });
    return { id };
  }
}
