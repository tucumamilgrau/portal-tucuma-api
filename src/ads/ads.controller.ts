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
import { AdsService } from './ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { AdminGuard } from '../auth/admin.guard';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // Público: front-end pede o anúncio ativo de um slot (ex: ?slot=article-sidebar).
  // Retorna null se não houver nenhum ativo — o front cai no placeholder decorativo.
  @Get()
  findActive(@Query('slot') slot: string) {
    return this.adsService.findActiveBySlot(slot);
  }

  @UseGuards(AdminGuard)
  @Get('admin')
  findAllForAdmin() {
    return this.adsService.findAllForAdmin();
  }

  @UseGuards(AdminGuard)
  @Post()
  create(@Body() dto: CreateAdDto) {
    return this.adsService.create(dto);
  }

  @UseGuards(AdminGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdDto) {
    return this.adsService.update(id, dto);
  }

  @UseGuards(AdminGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adsService.remove(id);
  }
}
