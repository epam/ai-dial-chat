import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import {
  DeploymentType,
  normalizeDeploymentTypesInput,
} from './deployment-type';

/** Query parameters shared by `GET /user/limits` and `GET /user/usage`. */
export class UserStatsQueryDto {
  @ApiPropertyOptional({
    description:
      'Deployment kinds to report on, comma-separated or as repeated keys. ' +
      'When omitted, the server-configured default kinds are reported.',
    enum: DeploymentType,
    isArray: true,
    example: [DeploymentType.Model, DeploymentType.Application],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DeploymentType, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    normalizeDeploymentTypesInput(value),
  )
  deploymentTypes?: DeploymentType[];
}
