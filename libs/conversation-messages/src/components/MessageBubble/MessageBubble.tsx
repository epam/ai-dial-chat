import { mergeClasses, MessageRole } from '@epam/ai-dial-chat-shared';
import { CSSProperties, FC } from 'react';
import type { MessageBubbleProps } from '../../models/MessageBubble.js';
import { BubblePosition } from '../../types/bubble-position.js';
import styles from './MessageBubble.module.scss';

export const MessageBubble: FC<MessageBubbleProps> = ({
  text,
  role,
  position = BubblePosition.Bottom,
  className,
  bubbleClassName,
  colors,
  typography,
}) => {
  const cssVars = {
    ...(colors?.userBackground && {
      '--cm-bubble-user-bg': colors.userBackground,
    }),
    ...(colors?.text && { '--cm-bubble-text': colors.text }),
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

  return role === MessageRole.User ? (
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
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
    </div>
  ) : (
    <div style={cssVars} className={mergeClasses('flex w-full', className)}>
      <div className={mergeClasses('flex w-fit items-center', bubbleClassName)}>
        <p className={mergeClasses(textClass, 'text-left')}>{text}</p>
      </div>
    </div>
  );
};

export default MessageBubble;
