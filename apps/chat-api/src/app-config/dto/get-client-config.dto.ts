import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { APP_ID_PATTERN } from '../../config/env/env-patterns';

export class GetClientConfigDto {
  /* The format check only; whether this deployment serves the identifier
   * (`CLIENT_CONFIG_APP_IDS`) is checked by AppConfigService. A repeated
   * parameter arrives as an array and fails `@IsString`. */
  @IsString()
  @Matches(APP_ID_PATTERN, {
    message:
      'appId must be a lowercase application identifier of 1-63 characters (a-z, 0-9 and hyphens, not starting with a hyphen)',
  })
  @ApiProperty({
    example: 'chat-ui',
    pattern: APP_ID_PATTERN.source,
    description:
      'Application identifier served by this deployment. An identifier the deployment does not serve is rejected with 400.',
  })
  appId!: string;
}
