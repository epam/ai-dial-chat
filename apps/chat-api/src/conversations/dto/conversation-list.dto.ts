import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConversationListItemDto {
  @ApiProperty({
    description:
      'Full DIAL Core resource URL used as the stable conversation identifier.',
    example:
      'conversations/default-bucket/cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8__My chat',
  })
  id!: string;

  @ApiProperty({
    description:
      'Human-readable conversation title (the resource `name` from DIAL Core).',
    example: 'My chat',
  })
  title!: string;

  @ApiProperty({
    description: 'Unix epoch milliseconds of the last update.',
    example: 1749600000000,
  })
  updatedAt!: number;

  @ApiProperty({
    description:
      'True when this conversation was shared with the current user by another user.',
    example: false,
  })
  sharedWithMe!: boolean;

  @ApiProperty({
    description:
      'True when this conversation was published to the organisation and is visible to the current user.',
    example: false,
  })
  publishedWithMe!: boolean;

  @ApiProperty({
    description: 'True when the user has pinned this conversation.',
    example: false,
  })
  isPinned!: boolean;

  @ApiProperty({
    description:
      'True when the current user does not have WRITE permission on this conversation.',
    example: false,
  })
  isReadonly!: boolean;

  @ApiProperty({
    description:
      'True when this conversation was created by a DIAL Scheduler run (its resource path matches the `.scheduler/{scheduleId}/{runId}` reserved segment).',
    example: false,
  })
  isScheduledTask!: boolean;

  @ApiPropertyOptional({
    description:
      'DIAL Scheduler schedule identifier. Present only when `isScheduledTask` is true.',
    example: 'sched_123',
  })
  scheduleId?: string;

  @ApiPropertyOptional({
    description:
      'DIAL Scheduler run identifier. Present only when `isScheduledTask` is true.',
    example: 'run_001',
  })
  runId?: string;
}

export class ConversationListResponseDto {
  @ApiProperty({ type: [ConversationListItemDto] })
  items!: ConversationListItemDto[];

  @ApiPropertyOptional({
    description:
      'Cursor for the next page. Present only when more results exist. Pass as `nextToken` in the next request.',
    example: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9',
  })
  nextToken?: string;
}
