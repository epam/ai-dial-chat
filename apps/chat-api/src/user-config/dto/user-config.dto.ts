import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export interface ConversationsConfig {
  pinnedIds: string[];
}

export interface ToolsetsConfig {
  installed: string[];
}

export interface DeploymentsConfig {
  installed: string[];
  selectedId: string | null;
}

export interface UserConfig {
  version: number;
  conversations: ConversationsConfig;
  toolsets: ToolsetsConfig;
  deployments: DeploymentsConfig;
}

export class ConversationsConfigDto implements ConversationsConfig {
  @ApiProperty({
    description: 'Pinned conversation identifiers.',
    example: ['conversations/default-bucket/gpt-4__My chat__uuid'],
    type: [String],
  })
  pinnedIds!: string[];
}

export class ToolsetsConfigDto implements ToolsetsConfig {
  @ApiProperty({
    description: 'Installed toolset identifiers.',
    example: ['toolset-abc'],
    type: [String],
  })
  installed!: string[];
}

export class DeploymentsConfigDto implements DeploymentsConfig {
  @ApiProperty({
    description: 'Installed deployment identifiers.',
    example: ['deployment-xyz'],
    type: [String],
  })
  installed!: string[];

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  selectedId!: string | null;
}

export class UserConfigDto implements UserConfig {
  @ApiProperty({
    description: 'User configuration schema version.',
    example: 2,
  })
  version!: number;

  @ApiProperty({ type: ConversationsConfigDto })
  conversations!: ConversationsConfigDto;

  @ApiProperty({ type: ToolsetsConfigDto })
  toolsets!: ToolsetsConfigDto;

  @ApiProperty({ type: DeploymentsConfigDto })
  deployments!: DeploymentsConfigDto;
}

export const CURRENT_CONFIG_VERSION = 3;

export const DEFAULT_USER_CONFIG: UserConfig = {
  version: CURRENT_CONFIG_VERSION,
  conversations: { pinnedIds: [] },
  toolsets: { installed: [] },
  deployments: { installed: [], selectedId: null },
};

export const migrateConfig = (raw: unknown): UserConfig => {
  if (raw == null || typeof raw !== 'object') {
    return {
      ...DEFAULT_USER_CONFIG,
      conversations: { pinnedIds: [] },
      toolsets: { installed: [] },
      deployments: { installed: [], selectedId: null },
    };
  }
  const obj = raw as Record<string, unknown>;

  // v1 shape: has pinnedConversationIds at root, no nested conversations
  if ('pinnedConversationIds' in obj && !('conversations' in obj)) {
    const pinnedIds = Array.isArray(obj['pinnedConversationIds'])
      ? (obj['pinnedConversationIds'] as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : [];
    return {
      version: CURRENT_CONFIG_VERSION,
      conversations: { pinnedIds },
      toolsets: { installed: [] },
      deployments: { installed: [], selectedId: null },
    };
  }

  // v2+ shape
  const convObj = obj['conversations'] as Record<string, unknown> | undefined;
  const convPinnedIds = convObj?.['pinnedIds'];
  const pinnedIds = Array.isArray(convPinnedIds)
    ? (convPinnedIds as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : [];

  const toolsetsObj = obj['toolsets'] as Record<string, unknown> | undefined;
  const toolsetsInstalledRaw = toolsetsObj?.['installed'];
  const toolsetsInstalled = Array.isArray(toolsetsInstalledRaw)
    ? (toolsetsInstalledRaw as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : [];

  const deploymentsObj = obj['deployments'] as
    | Record<string, unknown>
    | undefined;
  const deploymentsInstalledRaw = deploymentsObj?.['installed'];
  const deploymentsInstalled = Array.isArray(deploymentsInstalledRaw)
    ? (deploymentsInstalledRaw as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : [];

  // v2→v3: extract selectedId if present, default to null
  const deploymentsSelectedIdRaw = deploymentsObj?.['selectedId'];
  const deploymentsSelectedId =
    typeof deploymentsSelectedIdRaw === 'string'
      ? deploymentsSelectedIdRaw
      : null;

  return {
    version: CURRENT_CONFIG_VERSION,
    conversations: { pinnedIds },
    toolsets: { installed: toolsetsInstalled },
    deployments: {
      installed: deploymentsInstalled,
      selectedId: deploymentsSelectedId,
    },
  };
};
