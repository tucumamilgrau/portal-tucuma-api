import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateModerationSettingsDto } from './dto/update-moderation-settings.dto';

const SETTINGS_ID = 'singleton';
const DEFAULT_KEYWORDS =
  'cassino,aposta,empréstimo fácil,clique aqui,ganhe dinheiro,http://,https://,www.';

export type ClassifyResult = { flagged: boolean; reason?: string };

// Filtro heurístico simples (não é um modelo de IA/LLM): compara o texto do comentário
// contra uma lista de palavras-chave configurável e alguns padrões comuns de spam
// (texto todo em maiúsculas, caractere repetido em excesso). Roda de forma síncrona
// e local, sem depender de nenhum serviço externo.
@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    return this.prisma.moderationSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID, enabled: true, keywords: DEFAULT_KEYWORDS },
    });
  }

  async updateSettings(dto: UpdateModerationSettingsDto) {
    await this.getSettings(); // garante que a linha singleton existe antes do update
    return this.prisma.moderationSettings.update({
      where: { id: SETTINGS_ID },
      data: dto,
    });
  }

  async classify(text: string): Promise<ClassifyResult> {
    const settings = await this.getSettings();
    if (!settings.enabled) return { flagged: false };

    const normalized = text.toLowerCase();
    const keywords = settings.keywords
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);

    const matchedKeyword = keywords.find((kw) => normalized.includes(kw));
    if (matchedKeyword) {
      return {
        flagged: true,
        reason: `contém termo suspeito: "${matchedKeyword}"`,
      };
    }

    if (/(.)\1{5,}/.test(text)) {
      return { flagged: true, reason: 'caractere repetido em excesso' };
    }

    const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (letters.length > 20) {
      const upper = letters.replace(/[^A-ZÀ-Þ]/g, '');
      if (upper.length / letters.length > 0.8) {
        return { flagged: true, reason: 'texto todo em maiúsculas' };
      }
    }

    return { flagged: false };
  }

  async getStats() {
    const [total, flagged, pending] = await Promise.all([
      this.prisma.comment.count(),
      this.prisma.comment.count({ where: { flagged: true } }),
      this.prisma.comment.count({ where: { approved: false } }),
    ]);
    return {
      totalAnalyzed: total,
      totalFlagged: flagged,
      pendingReview: pending,
    };
  }
}
