import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { DEPLOYMENT_ID_PATTERN } from '../../common/validators/deployment-id.pattern';
import { IsSafeToolsetName } from '../../common/validators/safe-toolset-name.validator';

export class GetToolsetDto {
  @ApiProperty({
    description:
      'Toolset identifier. Slash-separated names must be percent-encoded in the URL (%2F).',
    example: 'my-toolset',
    pattern: DEPLOYMENT_ID_PATTERN.source,
  })
  @IsString()
  @IsSafeToolsetName()
  toolsetName!: string;
}
