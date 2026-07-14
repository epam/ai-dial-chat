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
  attachmentClickLabel,
  markdownComponents,
  ...props
}) => {
  if (role === MessageRole.Status) {
    return (
      <StatusMessageBubble
        titleText={props.statusTitleText}
        bodyText={props.statusBodyText ?? ''}
      />
    );
  }

  if (role === MessageRole.User) {
    return (
      <UserMessageBubble
        {...props}
        onAttachmentClick={onAttachmentClick}
        attachmentClickLabel={attachmentClickLabel}
      />
    );
  }

  return (
    <AssistantMessageBubble
      {...props}
      markdownComponents={markdownComponents}
      onAttachmentClick={onAttachmentClick}
      attachmentClickLabel={attachmentClickLabel}
    />
  );
};
