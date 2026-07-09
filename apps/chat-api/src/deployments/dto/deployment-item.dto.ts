import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeploymentFeaturesDto {
  @ApiProperty({
    description: 'Whether the deployment supports a custom system prompt',
  })
  systemPrompt!: boolean;

  @ApiProperty({
    description: 'Whether the deployment supports temperature control',
  })
  temperature!: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the deployment supports attaching folders from the file manager',
  })
  folderAttachments?: boolean;
}

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
    description: 'Short catalog-friendly intro from DIAL Core',
    maxLength: 90,
  })
  intro?: string;

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
    type: DeploymentFeaturesDto,
    description:
      'Feature flags from DIAL Core controlling which per-conversation settings are available',
  })
  features?: DeploymentFeaturesDto;

  @ApiPropertyOptional({
    description:
      'Topics associated with this deployment from DIAL Core (e.g. ["topic1", "topic2"])',
    type: [String],
  })
  topics?: string[];

  @ApiPropertyOptional({
    description:
      'Maximum number of attachments allowed per message; undefined when not specified by DIAL Core',
  })
  maxInputAttachments?: number;

  @ApiPropertyOptional({
    description:
      'Whether this deployment is installed by the current user (from user config)',
  })
  isInstalled?: boolean;

  @ApiPropertyOptional({
    description: 'Owner of the deployment as reported by DIAL Core',
  })
  owner?: string;

  @ApiPropertyOptional({
    description:
      'True when the deployment owner matches the current session user (computed post-cache)',
  })
  isMy?: boolean;

  @ApiPropertyOptional({
    description:
      'Parent folder path for application-type deployments (absent for root-level or non-application items)',
  })
  applicationFolder?: string;
}

export class DeploymentsResponseDto {
  @ApiProperty({ type: [DeploymentItemDto] })
  deployments!: DeploymentItemDto[];
}
