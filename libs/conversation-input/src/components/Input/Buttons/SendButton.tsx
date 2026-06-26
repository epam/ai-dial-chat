import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialTooltip } from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowRight } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from '../Input.module.scss';

/** Props for the {@link SendButton} component. */
export interface SendButtonProps {
  onSend?: () => void;
  isDisabled?: boolean;
  /** Accessible label for the send button. */
  ariaLabel?: string;
  /** Tooltip shown on hover. */
  title?: string;
}

export const SendButton: FC<SendButtonProps> = ({
  onSend,
  isDisabled = false,
  ariaLabel = 'Send message',
  title,
}) => {
  return (
    <DialTooltip tooltip={title} hideTooltip={!title}>
      <button
        className={mergeClasses(
          styles.sendButton,
          'flex size-[32px] cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed',
        )}
        aria-label={ariaLabel}
        onClick={() => onSend?.()}
        type="button"
        disabled={isDisabled}
      >
        <IconArrowNarrowRight size={DIAL_ICON_SIZE.LG} />
      </button>
    </DialTooltip>
  );
};
