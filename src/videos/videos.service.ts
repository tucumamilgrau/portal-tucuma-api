import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive() {
    return this.prisma.video.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllForAdmin() {
    return this.prisma.video.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateVideoDto) {
    return this.prisma.video.create({
      data: {
        ...dto,
        icon: dto.icon ?? '🎥',
      },
    });
  }

  async update(id: string, dto: UpdateVideoDto) {
    const existing = await this.prisma.video.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vídeo não encontrado');
    return this.prisma.video.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const existing = await this.prisma.video.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vídeo não encontrado');
    await this.prisma.video.delete({ where: { id } });
    return { id };
  }
}
