import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationErrorCode } from '../types/conversation-error-code.enum';

export class DuplicateConversationResponseDto {
  @ApiProperty({
    description: 'Path of the newly created duplicate conversation',
    example: 'conversations/bucket/gpt-4o__My conversation',
  })
  newPath!: string;
}

export class DuplicateConversationErrorDto {
  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({ example: 'Forbidden' })
  error!: string;

  @ApiProperty({
    example: "The conversation's model is not available for new conversations",
  })
  message!: string;

  @ApiPropertyOptional({
    enum: ConversationErrorCode,
    enumName: 'ConversationErrorCode',
    description:
      "Present when the duplicate was refused by a chat-api rule rather than by DIAL Core. `conversationDuplicateModelHidden`: the conversation's current model is hidden through `HIDDEN_ENTITY_TAGS`.",
  })
  code?: ConversationErrorCode;
}
