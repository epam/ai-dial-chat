import { IsString, IsNotEmpty } from 'class-validator';

export class AuthCallbackQueryDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}
