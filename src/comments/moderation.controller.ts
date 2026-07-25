import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { UpdateModerationSettingsDto } from './dto/update-moderation-settings.dto';
import { AdminGuard } from '../auth/admin.guard';

@UseGuards(AdminGuard)
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('settings')
  getSettings() {
    return this.moderationService.getSettings();
  }

  @Patch('settings')
  updateSettings(@Body() dto: UpdateModerationSettingsDto) {
    return this.moderationService.updateSettings(dto);
  }

  @Get('stats')
  getStats() {
    return this.moderationService.getStats();
  }
}
