import { mergeClasses, MessageRole } from '@epam/ai-dial-chat-shared';
import { AttachmentTray } from '@epam/ai-dial-conversation-input';
import { CSSProperties, FC } from 'react';
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
  const cssVars = {
    ...(colors?.text && { '--cm-bubble-text': colors.text }),
    ...(!typography?.fontClassName &&
      typography?.fontFamily && {
        '--cm-bubble-font-family': typography.fontFamily,
      }),
    ...(!typography?.fontClassName &&
      typography?.fontSize && { '--cm-bubble-font-size': typography.fontSize }),
    ...(!typography?.fontClassName &&
      typography?.fontWeight && {
        '--cm-bubble-font-weight': String(typography.fontWeight),
      }),
    ...(!typography?.fontClassName &&
      typography?.lineHeight && {
        '--cm-bubble-line-height': typography.lineHeight,
      }),
  } as CSSProperties;

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
