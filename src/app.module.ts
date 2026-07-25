import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { NewsModule } from './news/news.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthorsModule } from './authors/authors.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { MediaModule } from './media/media.module';
import { AdsModule } from './ads/ads.module';
import { ClassifiedsModule } from './classifieds/classifieds.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    NewsModule,
    CategoriesModule,
    AuthorsModule,
    AuthModule,
    CommentsModule,
    MediaModule,
    AdsModule,
    ClassifiedsModule,
    VideosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
