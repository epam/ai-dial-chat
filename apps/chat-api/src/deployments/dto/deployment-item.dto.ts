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
    type: [String],
    description: 'Interface types supported by this deployment',
  })
  interfaces?: string[];

  @ApiPropertyOptional({
    description:
      'Application type schema id from DIAL Core (present only for application deployments)',
  })
  applicationTypeSchemaId?: string;

  @ApiPropertyOptional({
    type: [String],
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
}

export class DeploymentsResponseDto {
  @ApiProperty({ type: [DeploymentItemDto] })
  deployments!: DeploymentItemDto[];
}
