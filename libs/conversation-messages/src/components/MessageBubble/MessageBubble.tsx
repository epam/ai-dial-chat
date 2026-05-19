import { mergeClasses } from '@epam/chat-shared';
import { FC } from 'react';
import { BubblePosition } from '../../types/bubble-position.js';

interface MessageBubbleProps {
  text: string;
  position?: BubblePosition;
  className?: string;
  bubbleClassName?: string;
}

export const MessageBubble: FC<MessageBubbleProps> = ({
  text,
  position = BubblePosition.Bottom,
  className,
  bubbleClassName,
}) => {
  const positionRadius =
    position === BubblePosition.Top ? 'rounded-br-[24px]' : 'rounded-tr-[24px]';

  return (
    <div className={mergeClasses('flex w-full', className)}>
      <div
        className={mergeClasses(
          'bg-layer-4 flex w-fit items-center justify-end rounded-bl-[16px] rounded-tl-[16px] px-6 py-4',
          positionRadius,
          bubbleClassName,
        )}
      >
        <p className="dial-body-text text-primary text-right">{text}</p>
      </div>
    </div>
  );
};

export default MessageBubble;
