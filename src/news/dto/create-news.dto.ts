import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

const STATUSES = ['DRAFT', 'SCHEDULED', 'PUBLISHED'] as const;

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  subtitle?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(400)
  excerpt: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  coverIcon?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  readTimeMin?: number;

  @IsIn(STATUSES)
  @IsOptional()
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsString()
  @IsNotEmpty()
  categorySlug: string;

  @IsString()
  @IsNotEmpty()
  authorSlug: string;
}
