import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconPlaystationSquare } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from '../Input.module.scss';

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
        'flex cursor-pointer items-center justify-center disabled:cursor-not-allowed',
      )}
      aria-label={ariaLabel}
      onClick={() => onStop?.()}
      type="button"
    >
      <IconPlaystationSquare
        size={DIAL_ICON_SIZE.LG}
        className={styles.stopIcon}
      />
    </button>
  );
};
