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
    description:
      'Operator-configured default deployment ID. Null when not configured.',
    example: 'gpt-4o',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  defaultDeploymentId!: string | null;

  @ApiPropertyOptional({
    description:
      'Public-facing DIAL Core base URL reachable from the browser. Null when DIAL_CORE_EXTERNAL_URL is not configured.',
    example: 'https://dial.example.com',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  dialCoreExternalUrl!: string | null;

  @ApiProperty({
    description:
      'Which File Manager tabs are shown to users. Defaults to all three currently-supported tabs.',
    type: [String],
    example: ['my_files', 'shared', 'organization'],
  })
  fileManagerTabs!: string[];

  @ApiProperty({
    description:
      'Whether the chat-overlay embedded runtime mode is enabled. Sourced from OVERLAY_ENABLED.',
    example: false,
  })
  overlayEnabled!: boolean;

  @ApiProperty({
    description:
      'Host origins allowed to embed this app. Sourced from ALLOWED_IFRAME_ORIGINS, the same list used for CSP frame-ancestors/frame-src.',
    type: [String],
    example: ['https://partner.example.com'],
  })
  overlayAllowedOrigins!: string[];

  @ApiPropertyOptional({
    description:
      'Operator-authored HTML announcement message shown in a dismissible top-of-app banner. Null when ANNOUNCEMENT_HTML_MESSAGE is not configured.',
    example: 'Welcome to <a href="https://your-site.example.com">DIAL</a>!',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  announcementHtml!: string | null;

  @ApiProperty({
    description:
      'Operator-authored HTML footer message shown below the chat input (desktop) and in the mobile user panel. Empty string when FOOTER_HTML_MESSAGE is not configured. Sanitized server-side; supports %%VERSION%% token.',
    example:
      'v%%VERSION%% — <a href="#" data-dial-action="requestApiKey">Request API Key</a>',
    type: String,
  })
  footerHtmlMessage!: string;
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
