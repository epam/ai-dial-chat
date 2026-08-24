import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsSafeToolsetName } from '../../common/validators/safe-toolset-name.validator';

export class GetToolsetDto {
  @ApiProperty({
    description:
      'Toolset identifier. Slash-separated names must be percent-encoded in the URL (%2F). Empty, dot, and dot-dot path segments are rejected, including when encoded.',
    example: 'my-toolset',
  })
  @IsString()
  @IsSafeToolsetName()
  toolsetName!: string;
}
