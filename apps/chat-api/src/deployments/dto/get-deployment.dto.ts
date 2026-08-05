import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { IsSafeDeploymentId } from '../../common/validators/safe-deployment-id.validator';

export class GetDeploymentDto {
  @ApiProperty({
    description:
      'DIAL deployment identifier. Slash-separated identifiers must be percent-encoded as one request path parameter.',
    example: 'applications/bucket/My App',
    maxLength: 2048,
  })
  @IsString()
  @MaxLength(2048)
  @IsSafeDeploymentId()
  deployment!: string;
}
