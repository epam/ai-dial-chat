import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { DEPLOYMENT_ID_PATTERN } from '../../common/validators/deployment-id.pattern';
import { IsSafeResourceId } from '../../common/validators/safe-resource-id.validator';

export class GetApplicationDto {
  @ApiProperty({
    description:
      'Application identifier. Slash-separated names must be percent-encoded in the URL (%2F). Empty, dot, and dot-dot path segments are rejected, including when encoded.',
    example: 'my-app__1.0',
    pattern: DEPLOYMENT_ID_PATTERN.source,
  })
  @IsString()
  @IsSafeResourceId()
  applicationName!: string;
}
