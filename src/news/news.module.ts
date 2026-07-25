import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { AuthModule } from '../auth/auth.module';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [AuthModule, CommentsModule],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
