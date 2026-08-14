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

export interface PromptsConfig {
  installed: string[];
}

export interface SkillsConfig {
  installed: string[];
}

export interface UserConfig {
  version: number;
  conversations: ConversationsConfig;
  toolsets: ToolsetsConfig;
  deployments: DeploymentsConfig;
  prompts: PromptsConfig;
  skills: SkillsConfig;
  /** Internal flag: set after legacy installation files have been consolidated once. */
  legacyMigrationDone?: boolean;
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

export class PromptsConfigDto implements PromptsConfig {
  @ApiProperty({
    description: 'Favorited prompt paths.',
    example: ['Work/AI/summarize'],
    type: [String],
  })
  installed!: string[];
}

export class SkillsConfigDto implements SkillsConfig {
  @ApiProperty({
    description: 'Favorited skill resource URLs.',
    example: ['skills/my-bucket/analysis/revenue-skill'],
    type: [String],
  })
  installed!: string[];
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

  @ApiProperty({ type: PromptsConfigDto })
  prompts!: PromptsConfigDto;

  @ApiProperty({ type: SkillsConfigDto })
  skills!: SkillsConfigDto;
}

export const CURRENT_CONFIG_VERSION = 5;

export const DEFAULT_USER_CONFIG: UserConfig = {
  version: CURRENT_CONFIG_VERSION,
  conversations: { pinnedIds: [] },
  toolsets: { installed: [] },
  deployments: { installed: [], selectedId: null },
  prompts: { installed: [] },
  skills: { installed: [] },
};

/*
 * `DEFAULT_USER_CONFIG` must never be handed out directly: the service mutates
 * the installed/pinned arrays in place, which would leak between requests.
 */
export const createDefaultUserConfig = (): UserConfig => ({
  version: CURRENT_CONFIG_VERSION,
  conversations: { pinnedIds: [] },
  toolsets: { installed: [] },
  deployments: { installed: [], selectedId: null },
  prompts: { installed: [] },
  skills: { installed: [] },
});

/** Returns the string entries of a stored `installed` array, dropping anything else. */
const readInstalledIds = (
  section: Record<string, unknown> | undefined,
): string[] => {
  const raw = section?.['installed'];
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (id): id is string => typeof id === 'string',
  );
};

export const migrateConfig = (raw: unknown): UserConfig => {
  if (raw == null || typeof raw !== 'object') {
    return createDefaultUserConfig();
  }
  const obj = raw as Record<string, unknown>;

  // v1 shape: has pinnedConversationIds at root, no nested conversations
  if ('pinnedConversationIds' in obj && !('conversations' in obj)) {
    const pinnedIds = Array.isArray(obj['pinnedConversationIds'])
      ? (obj['pinnedConversationIds'] as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        )
      : [];
    return { ...createDefaultUserConfig(), conversations: { pinnedIds } };
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
  const toolsetsInstalled = readInstalledIds(toolsetsObj);

  const deploymentsObj = obj['deployments'] as
    | Record<string, unknown>
    | undefined;
  const deploymentsInstalled = readInstalledIds(deploymentsObj);

  /* v3→v4: prompts favorites. Absent in every earlier shape. */
  const promptsObj = obj['prompts'] as Record<string, unknown> | undefined;
  const promptsInstalled = readInstalledIds(promptsObj);

  /* v4→v5: skill favorites. Absent in every earlier shape. */
  const skillsObj = obj['skills'] as Record<string, unknown> | undefined;
  const skillsInstalled = readInstalledIds(skillsObj);

  // v2→v3: extract selectedId if present, default to null
  const deploymentsSelectedIdRaw = deploymentsObj?.['selectedId'];
  const deploymentsSelectedId =
    typeof deploymentsSelectedIdRaw === 'string'
      ? deploymentsSelectedIdRaw
      : null;

  const legacyMigrationDone =
    obj['legacyMigrationDone'] === true ? true : undefined;

  return {
    version: CURRENT_CONFIG_VERSION,
    conversations: { pinnedIds },
    toolsets: { installed: toolsetsInstalled },
    deployments: {
      installed: deploymentsInstalled,
      selectedId: deploymentsSelectedId,
    },
    prompts: { installed: promptsInstalled },
    skills: { installed: skillsInstalled },
    legacyMigrationDone,
  };
};
