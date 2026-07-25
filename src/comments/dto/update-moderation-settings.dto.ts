import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateModerationSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  keywords?: string;
}
