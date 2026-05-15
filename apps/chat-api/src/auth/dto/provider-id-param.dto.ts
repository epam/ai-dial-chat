import { IsString, Matches } from 'class-validator';

export class ProviderIdParamDto {
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'providerId must match /^[a-z0-9][a-z0-9-]*$/',
  })
  providerId!: string;
}
