import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CommentFilter = 'all' | 'pending' | 'flagged';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllForAdmin(filter: CommentFilter = 'all') {
    const where =
      filter === 'pending'
        ? { approved: false }
        : filter === 'flagged'
          ? { flagged: true }
          : {};

    return this.prisma.comment.findMany({
      where,
      include: { news: { select: { slug: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setApproved(id: string, approved: boolean) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comentário não encontrado');
    return this.prisma.comment.update({
      where: { id },
      data: { approved, flagged: approved ? false : existing.flagged },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comentário não encontrado');
    await this.prisma.comment.delete({ where: { id } });
    return { id };
  }

  async report(id: string) {
    const existing = await this.prisma.comment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Comentário não encontrado');
    return this.prisma.comment.update({
      where: { id },
      data: { flagged: true, reportCount: { increment: 1 } },
    });
  }
}
