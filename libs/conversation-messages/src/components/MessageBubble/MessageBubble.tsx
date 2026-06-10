import { MessageRole } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { MessageBubbleProps } from '../../models/MessageBubble';
import { AssistantMessageBubble } from './AssistantMessageBubble';
import { StatusMessageBubble } from './StatusMessageBubble';
import { UserMessageBubble } from './UserMessageBubble';

/** Role-switching wrapper — renders `UserMessageBubble` or `AssistantMessageBubble` based on `role`. */
export const MessageBubble: FC<MessageBubbleProps> = ({ role, ...props }) => {
  if (role === MessageRole.Status) {
    return (
      <StatusMessageBubble
        titleText={props.statusTitleText}
        bodyText={props.statusBodyText ?? ''}
      />
    );
  }

  if (role === MessageRole.User) {
    return <UserMessageBubble {...props} />;
  }

  return (
    <AssistantMessageBubble
      {...props}
      deploymentIconUrl={props.deploymentIconUrl}
      deploymentDisplayName={props.deploymentDisplayName}
      thinkingLabel={props.thinkingLabel}
    />
  );
};
