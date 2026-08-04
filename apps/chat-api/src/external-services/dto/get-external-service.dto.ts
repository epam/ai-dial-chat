import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import {
  DEPLOYMENT_ID_PATTERN,
  DEPLOYMENT_ID_VALIDATION_MESSAGE,
} from '../../common/validators/deployment-id.pattern';

export class GetExternalServiceDto {
  @ApiProperty({
    description:
      'Application identifier the external service belongs to. Slash-separated ' +
      'paths must be percent-encoded in the URL (%2F).',
    example: 'applications%2Fpublic%2Ffinhub-via-openapi__1.0.0',
    pattern: DEPLOYMENT_ID_PATTERN.source,
  })
  @IsString()
  @Matches(DEPLOYMENT_ID_PATTERN, {
    message: DEPLOYMENT_ID_VALIDATION_MESSAGE,
  })
  appId!: string;

  @ApiProperty({
    description:
      "The external service id defined in the application's `external_services` config.",
    example: 'finhub-api2',
    pattern: DEPLOYMENT_ID_PATTERN.source,
  })
  @IsString()
  @Matches(DEPLOYMENT_ID_PATTERN, {
    message: DEPLOYMENT_ID_VALIDATION_MESSAGE,
  })
  serviceId!: string;
}
