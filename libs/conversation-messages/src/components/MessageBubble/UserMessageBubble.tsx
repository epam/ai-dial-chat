import { mergeClasses, MessageRole } from '@epam/ai-dial-chat-shared';
import { CSSProperties, FC } from 'react';
import type { UserMessageBubbleProps } from '../../models/MessageBubble.js';
import { BubblePosition } from '../../types/bubble-position.js';
import { MessageActions } from '../Message/MessageActions.js';
import { MessageAttachmentTray } from '../MessageAttachmentTray/MessageAttachmentTray.js';
import styles from './MessageBubble.module.scss';

export const UserMessageBubble: FC<UserMessageBubbleProps> = ({
  text,
  attachments,
  position = BubblePosition.Bottom,
  className,
  bubbleClassName,
  colors,
  typography,
  actions,
  alwaysVisibleActions: alwaysVisible,
}) => {
  const cssVars = {
    ...(colors?.userBackground && {
      '--cm-bubble-user-bg': colors.userBackground,
    }),
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

  const positionRadius =
    position === BubblePosition.Top ? 'rounded-br-[24px]' : 'rounded-tr-[24px]';

  const textClass = mergeClasses(styles.text, typography?.fontClassName);

  return (
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
      <div className="flex w-fit flex-col items-end gap-2">
        {attachments && attachments.length > 0 && (
          <MessageAttachmentTray attachments={attachments} side="user" />
        )}
        {text && (
          <div
            className={mergeClasses(
              styles.userBubble,
              'flex w-fit items-center justify-end rounded-bl-[16px] rounded-tl-[16px] px-6 py-4',
              positionRadius,
              bubbleClassName,
            )}
          >
            <p className={mergeClasses(textClass, 'text-right')}>{text}</p>
          </div>
        )}
        <MessageActions
          {...actions}
          alwaysVisible={alwaysVisible}
          role={MessageRole.User}
        />
      </div>
    </div>
  );
};
