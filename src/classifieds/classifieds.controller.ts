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
import { ClassifiedsService } from './classifieds.service';
import { CreateClassifiedDto } from './dto/create-classified.dto';
import { UpdateClassifiedDto } from './dto/update-classified.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('classifieds')
export class ClassifiedsController {
  constructor(private readonly classifiedsService: ClassifiedsService) {}

  @Get()
  findAllActive(@Query('category') category?: string) {
    return this.classifiedsService.findAllActive(category);
  }

  @UseGuards(AdminGuard)
  @Get('admin')
  findAllForAdmin() {
    return this.classifiedsService.findAllForAdmin();
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateClassifiedDto) {
    return this.classifiedsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClassifiedDto) {
    return this.classifiedsService.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classifiedsService.remove(id);
  }
}
