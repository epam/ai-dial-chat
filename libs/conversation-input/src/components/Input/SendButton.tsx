import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { mergeClasses } from '@epam/chat-shared';
import { IconArrowNarrowRight } from '@tabler/icons-react';
import { type FC } from 'react';
import styles from './Input.module.scss';

interface Props {
  onSend?: () => void;
}

export const SendButton: FC<Props> = ({ onSend }) => {
  return (
    <button
      className={mergeClasses(
        styles.sendButton,
        'flex size-[32px] cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed',
      )}
      onClick={() => onSend?.()}
      type="button"
    >
      <IconArrowNarrowRight size={DIAL_ICON_SIZE.LG} />
    </button>
  );
};
