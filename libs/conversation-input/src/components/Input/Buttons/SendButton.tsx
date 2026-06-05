import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconArrowNarrowRight } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from '../Input.module.scss';

interface Props {
  onSend?: () => void;
  isDisabled?: boolean;
  /** Accessible label for the send button. */
  ariaLabel?: string;
}

export const SendButton: FC<Props> = ({
  onSend,
  isDisabled = false,
  ariaLabel = 'Send message',
}) => {
  return (
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
  );
};
