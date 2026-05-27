import { buildCssVars, mergeClasses, MessageRole } from '@epam/ai-dial-chat-shared';
import { AttachmentTray } from '@epam/ai-dial-conversation-input';
import { FC } from 'react';
import type { AssistantMessageBubbleProps } from '../../models/MessageBubble.js';
import { MessageActions } from '../Message/MessageActions.js';
import styles from './MessageBubble.module.scss';

export const AssistantMessageBubble: FC<AssistantMessageBubbleProps> = ({
  text,
  className,
  bubbleClassName,
  colors,
  typography,
  actions,
  alwaysVisibleActions,
  attachments,
}) => {
  const noCustomClass = !typography?.fontClassName;
  const cssVars = buildCssVars({
    '--cm-bubble-text': colors?.text,
    '--cm-bubble-font-family': noCustomClass ? typography?.fontFamily : undefined,
    '--cm-bubble-font-size': noCustomClass ? typography?.fontSize : undefined,
    '--cm-bubble-font-weight': noCustomClass ? typography?.fontWeight : undefined,
    '--cm-bubble-line-height': noCustomClass ? typography?.lineHeight : undefined,
  });

  const textClass = mergeClasses(styles.text, typography?.fontClassName);

  return (
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
      <div
        className={mergeClasses(
          'flex w-fit flex-col items-start gap-4',
          bubbleClassName,
        )}
      >
        <p className={mergeClasses(textClass, 'text-left')}>{text}</p>
        <AttachmentTray attachments={attachments ?? []} />
        <MessageActions
          {...actions}
          alwaysVisible={alwaysVisibleActions}
          role={MessageRole.Assistant}
        />
      </div>
    </div>
  );
};
