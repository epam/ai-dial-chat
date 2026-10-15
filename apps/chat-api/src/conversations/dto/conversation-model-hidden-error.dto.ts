import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationErrorCode } from '../types/conversation-error-code.enum';

/** 403 body when a completion, share or publish would use a model hidden through `HIDDEN_ENTITY_TAGS`. */
export class ConversationModelHiddenErrorDto {
  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({ example: 'Forbidden' })
  error!: string;

  @ApiProperty({ example: 'The conversation model is no longer available' })
  message!: string;

  @ApiPropertyOptional({
    enum: ConversationErrorCode,
    enumName: 'ConversationErrorCode',
    description:
      "Present when the request was refused by a chat-api rule rather than by DIAL Core. `conversationDuplicateModelHidden`: the conversation's current model is hidden through `HIDDEN_ENTITY_TAGS`, so it cannot be duplicated. `conversationModelHidden`: the model a completion, share or publish would use is hidden through `HIDDEN_ENTITY_TAGS`.",
  })
  code?: ConversationErrorCode;
}
