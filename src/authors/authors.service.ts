import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';

@Injectable()
export class AuthorsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.author.findMany({ orderBy: { name: 'asc' } });
  }

  async findBySlug(slug: string) {
    const author = await this.prisma.author.findUnique({ where: { slug } });
    if (!author) throw new NotFoundException(`Autor "${slug}" não encontrado`);
    return author;
  }

  async create(dto: CreateAuthorDto) {
    const existing = await this.prisma.author.findUnique({
      where: { slug: dto.slug },
    });
    if (existing)
      throw new ConflictException(
        `Já existe um autor com o slug "${dto.slug}"`,
      );
    return this.prisma.author.create({ data: { ...dto, bio: dto.bio ?? '' } });
  }

  async update(id: string, dto: UpdateAuthorDto) {
    const existing = await this.prisma.author.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Autor não encontrado');

    if (dto.slug && dto.slug !== existing.slug) {
      const clash = await this.prisma.author.findUnique({
        where: { slug: dto.slug },
      });
      if (clash)
        throw new ConflictException(
          `Já existe um autor com o slug "${dto.slug}"`,
        );
    }

    return this.prisma.author.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.author.findUnique({
      where: { id },
      include: { _count: { select: { news: true } } },
    });
    if (!existing) throw new NotFoundException('Autor não encontrado');
    if (existing._count.news > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${existing._count.news} notícia(s) são deste autor. Mova-as para outro autor antes.`,
      );
    }
    await this.prisma.author.delete({ where: { id } });
    return { id };
  }
}
