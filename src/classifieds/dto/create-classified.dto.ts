import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const CATEGORIES = ['Imóveis', 'Veículos', 'Empregos', 'Serviços'] as const;

export class CreateClassifiedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsIn(CATEGORIES)
  category: (typeof CATEGORIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  price: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
