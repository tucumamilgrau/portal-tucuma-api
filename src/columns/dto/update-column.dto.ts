import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED'] as const;

export class UpdateColumnDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  excerpt?: string;

  @IsIn(STATUSES)
  @IsOptional()
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authorSlug?: string;
}
