import { ApiProperty } from '@nestjs/swagger';

export interface UserConfig {
  version: number;
  pinnedConversationIds: string[];
}

export class UserConfigDto implements UserConfig {
  @ApiProperty({
    description: 'User configuration schema version.',
    example: 1,
  })
  version!: number;

  @ApiProperty({
    description: 'Pinned conversation identifiers.',
    example: ['conversations/default-bucket/gpt-4__My chat__uuid'],
    type: [String],
  })
  pinnedConversationIds!: string[];
}

export const CURRENT_CONFIG_VERSION = 1;

export const DEFAULT_USER_CONFIG: UserConfig = {
  version: CURRENT_CONFIG_VERSION,
  pinnedConversationIds: [],
};

export function migrateConfig(raw: unknown): UserConfig {
  if (raw == null || typeof raw !== 'object') {
    return { ...DEFAULT_USER_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  const pinnedConversationIds = Array.isArray(obj['pinnedConversationIds'])
    ? (obj['pinnedConversationIds'] as unknown[]).filter(
        (id): id is string => typeof id === 'string',
      )
    : [];
  return { version: CURRENT_CONFIG_VERSION, pinnedConversationIds };
}
