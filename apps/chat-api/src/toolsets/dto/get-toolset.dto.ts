import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import {
  DEPLOYMENT_ID_PATTERN,
  DEPLOYMENT_ID_VALIDATION_MESSAGE,
} from '../../common/validators/deployment-id.pattern';

export class GetToolsetDto {
  @ApiProperty({
    description:
      'Toolset identifier. Slash-separated names must be percent-encoded in the URL (%2F).',
    example: 'my-toolset',
    pattern: DEPLOYMENT_ID_PATTERN.source,
  })
  @IsString()
  @Matches(DEPLOYMENT_ID_PATTERN, {
    message: DEPLOYMENT_ID_VALIDATION_MESSAGE,
  })
  toolsetName!: string;
}
