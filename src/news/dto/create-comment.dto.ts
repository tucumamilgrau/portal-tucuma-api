import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  authorName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  text: string;
}
