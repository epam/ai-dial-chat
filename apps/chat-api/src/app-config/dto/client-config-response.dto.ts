import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { AnnouncementItemDto } from './announcement-item.dto';
import { ApplicationVisualizerDto } from './application-visualizer.dto';
import { CustomVisualizerDto } from './custom-visualizer.dto';

/* ApplicationVisualizerDto is reachable only through an additionalProperties
 * $ref, which Swagger does not follow when collecting schemas, so the model
 * has to be registered explicitly or the reference dangles. */
@ApiExtraModels(ApplicationVisualizerDto)
export class ClientConfigDto {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Whether a text refinement model is configured. Missing means unavailable.',
    example: false,
  })
  aiTextRefinementAvailable?: boolean;

  @ApiProperty({
    description:
      'Active start-page celebration module ID selected by UI_EVENT. Null when UI_EVENT is absent or none. Event IDs are open-ended; clients ignore IDs not present in their local registry.',
    type: String,
    nullable: true,
    example: 'new-year',
  })
  activeEventId!: string | null;

  @ApiProperty({
    description:
      'Version string of the running chat application. Sourced from CHAT_VERSION; falls back to the workspace root package.json version — the one the release pipeline stamps — when that env var is unset or blank. Always a non-empty string.',
    type: String,
    example: '0.45.0',
  })
  appVersion!: string;

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

  @ApiPropertyOptional({
    description:
      'Isolated-origin URL of the deployed MCP Apps sandbox-proxy app. Null when MCP_APP_SANDBOX_URL is not configured.',
    example: 'https://mcp-app-sandbox.example.com',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  mcpAppSandboxUrl!: string | null;

  @ApiPropertyOptional({
    description:
      'Admin-controlled color theme override for MCP App Views. Null when MCP_APP_THEME is not configured — each client uses its own active theme.',
    enum: ['light', 'dark'],
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  mcpAppTheme!: 'light' | 'dark' | null;

  @ApiPropertyOptional({
    description:
      'Host application identifier sent to MCP App Views in hostContext.userAgent. Null when MCP_APP_USER_AGENT is not configured — defaults to "ai-dial-chat" on the client.',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  mcpAppUserAgent!: string | null;

  @ApiPropertyOptional({
    description:
      'Host application identifier sent to every mounted MCP App as hostInfo.name during its ui/initialize handshake. Null when MCP_APP_HOST_NAME is not configured — defaults to "ai-dial-chat" on the client.',
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  mcpAppHostName!: string | null;

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
      'Trusted HTTP(S) connection origins from ALLOWED_CONNECT_ORIGINS, including leading *. subdomain patterns. PDF previews use browser credentials for matching external origins and reject redirects. Empty by default; upstream credentialed CORS and browser cookie policy still apply.',
    type: [String],
    default: [],
    example: ['https://documents.example.com'],
  })
  allowedConnectOrigins?: string[];

  @ApiProperty({
    description:
      'When set, the complete list of OverlayFeature values that are enabled (replace semantics). Sourced from ENABLED_UI_FEATURES, filtered to recognized values. When null, the compiled-in DEFAULT_ENABLED_UI_FEATURES baseline is used. Does not affect an overlay host that supplies its own enabledFeatures.',
    type: [String],
    nullable: true,
    example: [
      'header',
      'likes',
      'conversations-sharing',
      'hide-new-conversation',
    ],
  })
  enabledUiFeatures!: string[] | null;

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

  @ApiPropertyOptional({
    description:
      'Plain-text heading shown in bold at the start of the announcement banner line. Never interpreted as markup. Null when ANNOUNCEMENT_TITLE is not configured or is blank.',
    example: '🎉 Welcome to DIAL! 🎉',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  announcementTitle!: string | null;

  @ApiPropertyOptional({
    description:
      'Supporting copy shown after the announcement banner title. Sanitized server-side to a safe HTML subset; anchors are forced to target="_blank" with rel="noopener noreferrer". Null when ANNOUNCEMENT_DESCRIPTION is not configured, is blank, or sanitizes away entirely.',
    example: 'Explore our AI offerings with your data.',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  announcementDescription!: string | null;

  @ApiProperty({
    description:
      'Announcements listed in the popover behind the banner\'s "+N announcements" pill, in configured order. Empty when ANNOUNCEMENTS is unset or contained no valid entries. Sourced from ANNOUNCEMENTS.',
    type: [AnnouncementItemDto],
  })
  announcements!: AnnouncementItemDto[];

  @ApiPropertyOptional({
    description:
      'Plain-text copy shown below the greeting heading on the new-chat start screen. Never interpreted as markup. Null when WELCOME_SCREEN_DESCRIPTION is not configured or is blank.',
    example:
      'Your secure, all-in-one AI assistant for web search, document analysis, research, brainstorming, and more.',
    nullable: true,
    type: String,
  })
  @IsOptional()
  @IsString()
  welcomeScreenDescription!: string | null;

  @ApiProperty({
    description:
      'Operator-authored HTML footer message shown below the chat input (desktop) and in the mobile user panel. Empty string when FOOTER_HTML_MESSAGE is not configured. Sanitized server-side; supports %%VERSION%% token.',
    example: 'v%%VERSION%% — <a href="https://example.com">Learn more</a>',
    type: String,
  })
  footerHtmlMessage!: string;

  @ApiProperty({
    description:
      'Registry of MIME → visualizer iframe mappings. Sourced from CUSTOM_VISUALIZERS. Empty when unset — the feature is dark by default.',
    type: [CustomVisualizerDto],
  })
  customVisualizers!: CustomVisualizerDto[];

  @ApiProperty({
    description:
      "Registry of application id → grouped visualizer mappings, keyed by a message's effective deployment id. Sourced from APPLICATION_VISUALIZERS. Every attachment an entry claims is delivered to one iframe together; an entry takes precedence over customVisualizers for the attachments it claims. The origin of each entry URL must also appear in ALLOWED_IFRAME_ORIGINS or the browser blocks the iframe. Each entry's passAuthInfo and passExplicitToken are accepted for configuration parity and are not consumed — auth is server-side and the browser holds no access token. Empty when unset — the feature is dark by default.",
    type: 'object',
    additionalProperties: { $ref: getSchemaPath(ApplicationVisualizerDto) },
  })
  applicationVisualizers!: Record<string, ApplicationVisualizerDto>;

  @ApiProperty({
    description:
      'Public client-owned variables from CUSTOM_CLIENT_VARIABLES. Arbitrary JSON object; empty when unset or invalid. The BFF does not interpret its keys. Never put secrets here.',
    type: 'object',
    additionalProperties: true,
    default: {},
  })
  customVariables!: Record<string, unknown>;

  @ApiProperty({
    description:
      "Allowed claim/category names selectable as a publication access rule's source. Sourced from PUBLICATION_FILTER_SOURCES; falls back to the legacy default when unset or empty.",
    type: [String],
    example: ['title', 'role', 'dial_roles'],
  })
  publicationFilterSources!: string[];

  @ApiProperty({
    description:
      'Maximum attachment/upload file size in bytes. Sourced from FILE_UPLOAD_MAX_BYTES — the same variable that bounds the POST /api/v1/files Multer limit — so the client can reject an oversized file before attempting to upload it.',
    example: 536870912,
  })
  maxAttachmentFileSizeBytes!: number;
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
