import {
  buildCssVars,
  mergeClasses,
  MessageRole,
} from '@epam/ai-dial-chat-shared';
import { AttachmentTray } from '@epam/ai-dial-conversation-input';
import { FC } from 'react';
import type { UserMessageBubbleProps } from '../../models/MessageBubble.js';
import { BubblePosition } from '../../types/bubble-position.js';
import { MessageActions } from '../Message/MessageActions.js';
import styles from './MessageBubble.module.scss';

/** User-authored message bubble, right-aligned with configurable radius based on group position. */
export const UserMessageBubble: FC<UserMessageBubbleProps> = ({
  text,
  position = BubblePosition.Bottom,
  className,
  bubbleClassName,
  styles: bubbleStyles,
  actions,
  hasAlwaysVisibleActions,
  attachments,
}) => {
  const { colors, typography } = bubbleStyles ?? {};
  const noCustomClass = !typography?.fontClassName;
  const cssVars = buildCssVars({
    '--cm-bubble-user-bg': colors?.userBackground,
    '--cm-bubble-text': colors?.text,
    '--cm-bubble-font-family': noCustomClass
      ? typography?.fontFamily
      : undefined,
    '--cm-bubble-font-size': noCustomClass ? typography?.fontSize : undefined,
    '--cm-bubble-font-weight': noCustomClass
      ? typography?.fontWeight
      : undefined,
    '--cm-bubble-line-height': noCustomClass
      ? typography?.lineHeight
      : undefined,
  });

  const positionRadius =
    position === BubblePosition.Top ? 'rounded-br-[24px]' : 'rounded-tr-[24px]';

  const textClass = mergeClasses(styles.text, typography?.fontClassName);
  return (
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
      <div className="flex w-fit flex-col items-end gap-2">
        <AttachmentTray attachments={attachments ?? []} />
        {text && (
          <div
            className={mergeClasses(
              styles.userBubble,
              'flex w-fit items-center justify-end rounded-bl-[16px] rounded-tl-[16px] px-6 py-4',
              positionRadius,
              bubbleClassName,
            )}
          >
            <p
              className={mergeClasses(
                textClass,
                'whitespace-pre-wrap text-left [overflow-wrap:anywhere]',
              )}
            >
              {text}
            </p>
          </div>
        )}
        <MessageActions
          {...actions}
          isAlwaysVisible={hasAlwaysVisibleActions}
          role={MessageRole.User}
        />
      </div>
    </div>
  );
};
