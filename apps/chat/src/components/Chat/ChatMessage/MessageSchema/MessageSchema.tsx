import { memo } from 'react';

import { AssistantSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/AssistantSchema';
import { UserSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/UserSchema';

import { Message, Role } from '@epam/ai-dial-shared';

interface MessageFormSchemaProps {
  message: Message;
  allMessages: Message[];
  messageIndex: number;
  isLastMessage: boolean;
}

const _MessageSchema = ({
  message,
  allMessages,
  messageIndex,
  isLastMessage,
}: MessageFormSchemaProps) => {
  switch (message.role) {
    case Role.Assistant:
      return (
        <AssistantSchema message={message} isLastMessage={isLastMessage} />
      );
    case Role.User:
      return (
        <UserSchema
          message={message}
          messageIndex={messageIndex}
          allMessages={allMessages}
        />
      );
    default:
      return null;
  }
};

_MessageSchema.displayName = 'MessageSchema';

export const MessageSchema = memo(_MessageSchema);
