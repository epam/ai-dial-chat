import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeploymentItemDto {
  @ApiProperty({ description: 'Unique stable identifier from DIAL Core' })
  id!: string;

  @ApiProperty({ description: 'Display name, falls back to id when absent' })
  displayName!: string;

  @ApiProperty({ enum: ['model', 'application', 'toolset'] })
  type!: 'model' | 'application' | 'toolset';

  @ApiPropertyOptional({ description: 'Icon URL from DIAL Core' })
  iconUrl?: string;

  @ApiPropertyOptional({ description: 'Description from DIAL Core' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Interface types supported by this deployment',
  })
  interfaces?: string[];

  @ApiPropertyOptional({
    description: 'Display version from DIAL Core',
  })
  displayVersion?: string;

  @ApiPropertyOptional({
    description: 'Whether this deployment is featured (configured via env)',
  })
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this deployment is hidden (configured via env)',
  })
  isHidden?: boolean;

  @ApiPropertyOptional({
    description:
      'Timestamp of last update time from DIAL Core (e.g. 1714768496000)',
  })
  updatedAt?: number;

  @ApiPropertyOptional({
    description:
      'Application type schema id from DIAL Core (present only for application deployments)',
  })
  applicationTypeSchemaId?: string;

  @ApiPropertyOptional({
    description:
      'Accepted MIME types for input attachments from DIAL Core (e.g. ["audio/*", "image/*"])',
  })
  inputAttachmentTypes?: string[];

  @ApiPropertyOptional({
    description:
      'Topics associated with this deployment from DIAL Core (e.g. ["topic1", "topic2"])',
  })
  topics?: string[];

  @ApiPropertyOptional({
    description:
      'Whether this deployment is installed by the current user (from user config)',
  })
  isInstalled?: boolean;
}

export class DeploymentsResponseDto {
  @ApiProperty({ type: [DeploymentItemDto] })
  deployments!: DeploymentItemDto[];
}
