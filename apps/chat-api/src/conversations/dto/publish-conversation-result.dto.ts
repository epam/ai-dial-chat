import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body for `POST /api/v1/conversations/publish` and each entry of
 * `GET /api/v1/conversations/publish-history`. Unlike `PublishResultDto`,
 * there is no `version`, and `entityType`/`entityId` collapse into a single
 * `path` field since conversations are the only publishable resource kind
 * on this endpoint.
 */
export class PublishConversationResultDto {
  @ApiProperty({ example: 'conversations/bucket-123/my-conversation-abc' })
  path!: string;

  @ApiProperty({ example: 'Organization/Data Science/Shared chats' })
  folderPath!: string;

  @ApiProperty({ example: '2026-07-15T10:00:00.000Z' })
  publishedAt!: string;

  @ApiProperty({ example: 'Valery Dluski' })
  publishedBy!: string;
}
