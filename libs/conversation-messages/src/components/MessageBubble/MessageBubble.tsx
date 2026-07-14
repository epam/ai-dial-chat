import { MessageRole } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { MessageBubbleProps } from '../../models/message-bubble';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import { StatusMessageBubble } from './StatusMessageBubble';
import { UserMessageBubble } from './UserMessageBubble';

/** Role-switching wrapper — renders `UserMessageBubble` or `AssistantMessageBubble` based on `role`. */
export const MessageBubble: FC<MessageBubbleProps> = ({
  role,
  onAttachmentClick,
  markdownComponents,
  ...props
}) => {
  if (role === MessageRole.Status) {
    return (
      <StatusMessageBubble
        titleText={props.labels?.statusTitleText}
        bodyText={props.labels?.statusBodyText ?? ''}
      />
    );
  }

  if (role === MessageRole.User) {
    return (
      <UserMessageBubble {...props} onAttachmentClick={onAttachmentClick} />
    );
  }

  return (
    <AssistantMessageBubble
      {...props}
      markdownComponents={markdownComponents}
      onAttachmentClick={onAttachmentClick}
    />
  );
};
