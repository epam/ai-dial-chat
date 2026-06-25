import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ClientConfigDto {
  @ApiProperty({
    description:
      'Deployment ID of the ASR model. Null when ASR is not configured.',
    type: String,
    nullable: true,
    example: 'whisper-1',
  })
  asrModelId!: string | null;

  @ApiProperty({
    description:
      'Maximum audio file size in bytes accepted by the transcription endpoint.',
    example: 5242880,
  })
  transcribeSizeLimitBytes!: number;

  @ApiPropertyOptional({
    description: 'Operator-configured default deployment ID. Null when not configured.',
    example: 'gpt-4o',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  defaultDeploymentId!: string | null;
}

export class ClientConfigMetadataDto {
  @ApiProperty({ description: 'ISO timestamp when the config was resolved.' })
  resolvedAt!: string;

  @ApiProperty({
    description: 'Cache TTL in seconds applied to this response.',
  })
  cacheTtlSeconds!: number;
}

export class ClientConfigResponseDto {
  @ApiProperty({ description: 'Application identifier.', example: 'chat-ui' })
  appId!: string;

  @ApiProperty({
    description: 'Feature flags — boolean per feature key.',
    example: { asrEnabled: false },
  })
  features!: Record<string, boolean>;

  @ApiProperty({
    description: 'Non-boolean configuration values.',
    type: ClientConfigDto,
  })
  config!: ClientConfigDto;

  @ApiPropertyOptional({
    description: 'Resolution metadata.',
    type: ClientConfigMetadataDto,
  })
  metadata?: ClientConfigMetadataDto;
}
