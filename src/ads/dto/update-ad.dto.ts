import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

const SLOTS = ['sidebar', 'article-sidebar', 'footer-banner'] as const;

export class UpdateAdDto {
  @IsOptional()
  @IsIn(SLOTS)
  slot?: (typeof SLOTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true },
    { message: 'linkUrl deve ser uma URL válida (com http:// ou https://)' },
  )
  linkUrl?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;
}
