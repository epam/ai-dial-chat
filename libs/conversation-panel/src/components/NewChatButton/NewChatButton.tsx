import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import panelStyles from '../ConversationPanel/ConversationPanel.module.scss';
import styles from './NewChatButton.module.scss';

/** Props for `NewChatButton`. */
export interface NewChatButtonProps {
  /** Button label text (e.g. `"New chat"`). */
  label: string;
  /** Called when the button is clicked or activated via keyboard. */
  onClick: () => void;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
}

/** Full-width button rendered at the top of the conversation panel to start a new chat. */
export const NewChatButton: FC<NewChatButtonProps> = memo(
  ({ label, onClick, labelClassName = 'dial-small-text' }) => (
    <div className={mergeClasses('border-b px-2 py-1', panelStyles.divider)}>
      <button
        onClick={onClick}
        type="button"
        className={mergeClasses(
          'flex h-[32px] w-full cursor-pointer items-center gap-2 px-3 py-1',
          styles.button,
        )}
      >
        <div
          className={mergeClasses(
            'flex size-[20px] items-center justify-center rounded-full',
            styles.iconCircle,
          )}
        >
          <IconPlus size={DIAL_ICON_SIZE.SM} className={styles.iconColor} />
        </div>
        <span className={labelClassName}>{label}</span>
      </button>
    </div>
  ),
);
