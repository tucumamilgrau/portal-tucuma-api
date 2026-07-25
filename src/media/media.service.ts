import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

const MEDIA_DIR = join(process.cwd(), 'uploads', 'media');
// Nomes são sempre gerados por randomUUID() + extensão no upload — qualquer coisa fora
// desse formato é rejeitada antes de tocar o filesystem (evita path traversal via ../).
const SAFE_FILENAME = /^[a-zA-Z0-9-]+\.[a-zA-Z0-9]+$/;

export type MediaItem = {
  filename: string;
  url: string;
  size: number;
  uploadedAt: string;
};

@Injectable()
export class MediaService {
  async list(): Promise<MediaItem[]> {
    let entries: string[];
    try {
      entries = await readdir(MEDIA_DIR);
    } catch {
      return [];
    }

    const items = await Promise.all(
      entries
        .filter((name) => name !== '.gitkeep')
        .map(async (name) => {
          const info = await stat(join(MEDIA_DIR, name));
          return this.describeFromStat(name, info.size, info.mtime);
        }),
    );

    return items.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async describe(filename: string): Promise<MediaItem> {
    const info = await stat(join(MEDIA_DIR, filename));
    return this.describeFromStat(filename, info.size, info.mtime);
  }

  async remove(filename: string): Promise<{ filename: string }> {
    if (!SAFE_FILENAME.test(filename)) {
      throw new BadRequestException('Nome de arquivo inválido');
    }
    try {
      await unlink(join(MEDIA_DIR, filename));
    } catch {
      throw new NotFoundException('Arquivo não encontrado');
    }
    return { filename };
  }

  private describeFromStat(
    filename: string,
    size: number,
    mtime: Date,
  ): MediaItem {
    return {
      filename,
      url: `/uploads/media/${filename}`,
      size,
      uploadedAt: mtime.toISOString(),
    };
  }
}
