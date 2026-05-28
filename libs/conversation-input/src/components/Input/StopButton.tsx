import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconPlayerStopFilled } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from './Input.module.scss';

interface Props {
  onStop?: () => void;
  /** Accessible label for the stop button. */
  ariaLabel?: string;
}

export const StopButton: FC<Props> = ({
  onStop,
  ariaLabel = 'Stop streaming',
}) => {
  return (
    <button
      className={mergeClasses(
        styles.sendButton,
        'flex size-[32px] cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed',
      )}
      aria-label={ariaLabel}
      onClick={() => onStop?.()}
      type="button"
    >
      <IconPlayerStopFilled size={DIAL_ICON_SIZE.SM} />
    </button>
  );
};
