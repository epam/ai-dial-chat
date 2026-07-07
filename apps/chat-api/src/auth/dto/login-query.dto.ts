import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginQueryDto {
  /*
   * Application URL to return to after successful authentication.
   * Detailed origin/scheme validation lives in callback-url.util.ts.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  callbackUrl?: string;
}
