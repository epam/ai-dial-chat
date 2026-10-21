import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import {
  DEPLOYMENT_ID_PATTERN,
  DEPLOYMENT_ID_VALIDATION_MESSAGE,
} from '../../common/validators/deployment-id.pattern';

export class ListExternalServicesDto {
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
}

export class GetExternalServiceDto extends ListExternalServicesDto {
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

/**
 * One service id, as a single path segment: the write routes (PUT/DELETE) put it straight into Core's
 * `/v1/applications/{appId}/external-services/{id}`, so it may carry no `/` and may not be `.` or `..`.
 */
export const EXTERNAL_SERVICE_ID_PATTERN =
  /^(?!\.{1,2}$)[A-Za-z0-9._~-]{1,128}$/;

export class ExternalServiceDefinitionParamsDto extends ListExternalServicesDto {
  @ApiProperty({
    description:
      "The external service id in the application's `external_services` config: one path segment.",
    example: 'teams-bot',
    pattern: EXTERNAL_SERVICE_ID_PATTERN.source,
  })
  @IsString()
  @Matches(EXTERNAL_SERVICE_ID_PATTERN, {
    message:
      'serviceId must be one path segment of letters, digits, ".", "_", "~" or "-"',
  })
  serviceId!: string;
}
