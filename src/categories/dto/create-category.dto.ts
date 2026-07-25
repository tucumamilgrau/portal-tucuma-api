import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const COLORS = ['primary', 'alert', 'highlight', 'green'] as const;

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug deve conter apenas letras minúsculas, números e hífen',
  })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @IsIn(COLORS)
  color: (typeof COLORS)[number];
}
