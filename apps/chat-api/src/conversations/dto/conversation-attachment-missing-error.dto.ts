import { ApiProperty } from '@nestjs/swagger';
import { ConversationErrorCode } from '../types/conversation-error-code.enum';

/** 422 body when a file the conversation's attachments reference no longer exists, so the conversation cannot be published. */
export class ConversationAttachmentMissingErrorDto {
  @ApiProperty({ example: 422 })
  statusCode!: number;

  @ApiProperty({ example: 'Unprocessable Entity' })
  error!: string;

  @ApiProperty({
    example:
      'The conversation references attachment files that no longer exist: files/bucket-123/old.pdf',
  })
  message!: string;

  @ApiProperty({
    enum: ConversationErrorCode,
    enumName: 'ConversationErrorCode',
    example: ConversationErrorCode.AttachmentMissing,
  })
  code!: ConversationErrorCode;

  @ApiProperty({
    type: [String],
    example: ['files/bucket-123/old.pdf'],
    description: 'Urls of the attachment files that no longer exist',
  })
  missingFiles!: string[];
}
