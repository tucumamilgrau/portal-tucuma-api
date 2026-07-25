import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassifiedDto } from './dto/create-classified.dto';
import { UpdateClassifiedDto } from './dto/update-classified.dto';

@Injectable()
export class ClassifiedsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive(category?: string) {
    return this.prisma.classified.findMany({
      where: {
        active: true,
        ...(category && category !== 'Todos' ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllForAdmin() {
    return this.prisma.classified.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateClassifiedDto) {
    return this.prisma.classified.create({
      data: {
        ...dto,
        description: dto.description ?? '',
        icon: dto.icon ?? '📦',
      },
    });
  }

  async update(id: string, dto: UpdateClassifiedDto) {
    const existing = await this.prisma.classified.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Classificado não encontrado');
    return this.prisma.classified.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.classified.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Classificado não encontrado');
    await this.prisma.classified.delete({ where: { id } });
    return { id };
  }
}
