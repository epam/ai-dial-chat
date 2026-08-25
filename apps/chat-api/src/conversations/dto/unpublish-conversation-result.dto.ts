import { ApiProperty } from '@nestjs/swagger';

/**
 * Response body for `POST /api/v1/conversations/unpublish`.
 *
 * The field names deliberately differ from
 * {@link PublishConversationResultDto}'s `publishedAt`/`publishedBy`: DIAL
 * Core returns a `PENDING` publication, so this describes a submitted
 * request, not a completed removal. No field here may assert that the
 * conversation is no longer published.
 */
export class UnpublishConversationResultDto {
  @ApiProperty({ example: 'conversations/bucket-123/my-conversation-abc' })
  path!: string;

  @ApiProperty({ example: 'Organization/Data Science/Shared chats' })
  folderPath!: string;

  @ApiProperty({ example: '2026-08-13T10:00:00.000Z' })
  requestedAt!: string;

  @ApiProperty({ example: 'Test User' })
  requestedBy!: string;
}
