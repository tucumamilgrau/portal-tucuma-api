import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { NewsService } from './news.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { AdminGuard } from '../auth/admin.guard';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.newsService.findAll(
      category,
      limit ? Number(limit) : undefined,
    );
  }

  @Get('featured')
  findFeatured(@Query('limit') limit?: string) {
    return this.newsService.findFeatured(limit ? Number(limit) : undefined);
  }

  @Get('most-read')
  findMostRead(@Query('limit') limit?: string) {
    return this.newsService.findMostRead(limit ? Number(limit) : undefined);
  }

  @UseGuards(AdminGuard)
  @Get('admin')
  findAllForAdmin() {
    return this.newsService.findAllForAdmin();
  }

  @UseGuards(AdminGuard)
  @Get('admin/stats')
  getStats() {
    return this.newsService.getStats();
  }

  @UseGuards(AdminGuard)
  @Get('admin/:id')
  findOneForAdmin(@Param('id') id: string) {
    return this.newsService.findByIdForAdmin(id);
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateNewsDto) {
    return this.newsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id')
  update(@Param('id') id: string, @Body() dto: UpdateNewsDto) {
    return this.newsService.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Post('admin/:id/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/news',
        filename: (_req, file, cb) =>
          cb(
            null,
            `${randomUUID()}${extname(file.originalname).toLowerCase()}`,
          ),
      }),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Envie um arquivo de imagem (JPEG, PNG, WebP ou GIF)',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadCover(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return this.newsService.setCoverImage(id, `/uploads/news/${file.filename}`);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/:id/cover')
  removeCover(@Param('id') id: string) {
    return this.newsService.setCoverImage(id, null);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/:id')
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.newsService.findBySlug(slug);
  }

  @Post(':slug/comments')
  addComment(@Param('slug') slug: string, @Body() dto: CreateCommentDto) {
    return this.newsService.addComment(slug, dto);
  }
}
