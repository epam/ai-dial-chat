import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsSafeDeploymentId } from '../../common/validators/safe-deployment-id.validator';

/*
 * Mirrors the `ui://` scheme check DIAL Core itself performs on this query
 * param (`McpResourceController`, `epam/ai-dial-core` PR #1745) — rejecting
 * clearly-invalid values here avoids an unnecessary round trip to Core.
 */
const UI_RESOURCE_URI_PATTERN = /^ui:\/\/[\w.\-~!$&'()*+,;=:@/%]+$/;
const UI_RESOURCE_URI_MESSAGE = 'Must be a valid ui:// resource URI';

/** Deployment kind, matching which of Core's two MCP proxy route prefixes it resolves through. */
export enum McpDeploymentKindDto {
  Toolset = 'toolset',
  Application = 'application',
}

/** Query params for `GET /toolsets/{toolsetId}/mcp-app-resource`. */
export class GetMcpAppResourceDto {
  @ApiProperty({ example: 'ui://widget/1' })
  @IsString()
  @Matches(UI_RESOURCE_URI_PATTERN, { message: UI_RESOURCE_URI_MESSAGE })
  resourceUri!: string;
}

/*
 * Identifier-safe allowlist for `toolName` — mirrors how MCP tool names are
 * conventionally restricted (letters, digits, underscore, hyphen, dot).
 */
const TOOL_NAME_PATTERN = /^[\w.-]+$/;
const TOOL_NAME_MESSAGE =
  'Must contain only letters, digits, underscore, hyphen, or dot';

/** Request body for `POST /toolsets/{toolsetId}/mcp-app-tool-call`. */
export class McpAppToolCallRequestDto {
  @ApiProperty({ example: 'refresh_data' })
  @IsString()
  @IsNotEmpty()
  @Matches(TOOL_NAME_PATTERN, { message: TOOL_NAME_MESSAGE })
  toolName!: string;

  @ApiProperty({ example: { range: '7d' }, type: Object })
  @IsObject()
  arguments!: Record<string, unknown>;

  @ApiProperty({
    enum: McpDeploymentKindDto,
    description:
      "Which of Core's MCP proxy route prefixes to use for this deployment.",
  })
  @IsEnum(McpDeploymentKindDto)
  kind!: McpDeploymentKindDto;
}

/** Response body for `POST /toolsets/{toolsetId}/mcp-app-tool-call`. */
export class McpAppToolCallResponseDto {
  @ApiProperty({
    description: "Unwrapped `result` field of the tool's JSON-RPC response.",
    type: Object,
  })
  result!: unknown;
}

/** Query params for `GET /toolsets/mcp-apps/tools`. */
export class ListMcpAppToolsQueryDto {
  @ApiProperty({
    description:
      'DIAL deployment identifier (toolset or application) to list MCP Apps-capable tools for.',
    example: 'toolsets/bucket/weather__0.0.1',
    maxLength: 2048,
  })
  @IsString()
  @MaxLength(2048)
  @IsSafeDeploymentId()
  deploymentId!: string;

  @ApiProperty({
    enum: McpDeploymentKindDto,
    description:
      "Which of Core's MCP proxy route prefixes to use for this deployment.",
  })
  @IsEnum(McpDeploymentKindDto)
  kind!: McpDeploymentKindDto;
}

/** A single MCP tool that declares an MCP Apps UI resource. */
export class McpAppToolSummaryDto {
  @ApiProperty({ example: 'refresh_data' })
  @IsString()
  @IsNotEmpty()
  toolName!: string;

  @ApiProperty({ example: 'ui://widget/1' })
  @IsString()
  @IsNotEmpty()
  resourceUri!: string;
}

/** Response body for `GET /toolsets/mcp-apps/tools`. */
export class ListMcpAppToolsResponseDto {
  @ApiProperty({ type: [McpAppToolSummaryDto] })
  tools!: McpAppToolSummaryDto[];
}
