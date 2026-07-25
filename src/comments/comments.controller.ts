import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommentsService, type CommentFilter } from './comments.service';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(AdminGuard)
  @Get('admin')
  findAllForAdmin(@Query('filter') filter?: CommentFilter) {
    return this.commentsService.findAllForAdmin(filter);
  }

  @UseGuards(AdminGuard)
  @Patch('admin/:id')
  setApproved(@Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.commentsService.setApproved(id, dto.approved);
  }

  @UseGuards(AdminGuard)
  @Delete('admin/:id')
  remove(@Param('id') id: string) {
    return this.commentsService.remove(id);
  }

  // Público: qualquer leitor pode denunciar um comentário — cai na fila de revisão do admin.
  @Post(':id/report')
  report(@Param('id') id: string) {
    return this.commentsService.report(id);
  }
}
