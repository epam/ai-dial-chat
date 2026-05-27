import { MessageRole } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { MessageBubbleProps } from '../../models/MessageBubble.js';
import { AssistantMessageBubble } from './AssistantMessageBubble.js';
import { UserMessageBubble } from './UserMessageBubble.js';

export const MessageBubble: FC<MessageBubbleProps> = ({
  role,
  starters,
  onSelectStarter,
  ...props
}) => {
  return role === MessageRole.User ? (
    <UserMessageBubble {...props} />
  ) : (
    <AssistantMessageBubble
      {...props}
      starters={starters}
      onSelectStarter={onSelectStarter}
    />
  );
};
