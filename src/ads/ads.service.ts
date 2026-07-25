import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

@Injectable()
export class AdsService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveBySlot(slot: string) {
    const now = new Date();
    const ad = await this.prisma.advertisement.findFirst({
      where: {
        slot,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
    return ad;
  }

  findAllForAdmin() {
    return this.prisma.advertisement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateAdDto) {
    return this.prisma.advertisement.create({
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }

  async update(id: string, dto: UpdateAdDto) {
    const existing = await this.prisma.advertisement.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Anúncio não encontrado');
    return this.prisma.advertisement.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.advertisement.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Anúncio não encontrado');
    await this.prisma.advertisement.delete({ where: { id } });
    return { id };
  }
}
