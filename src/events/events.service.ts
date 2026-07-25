import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive() {
    return this.prisma.event.findMany({
      where: { active: true, eventDate: { gte: new Date() } },
      orderBy: { eventDate: 'asc' },
    });
  }

  findAllForAdmin() {
    return this.prisma.event.findMany({ orderBy: { eventDate: 'asc' } });
  }

  create(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: { ...dto, eventDate: new Date(dto.eventDate) },
    });
  }

  async update(id: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Evento não encontrado');
    return this.prisma.event.update({
      where: { id },
      data: {
        ...dto,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Evento não encontrado');
    await this.prisma.event.delete({ where: { id } });
    return { id };
  }
}
