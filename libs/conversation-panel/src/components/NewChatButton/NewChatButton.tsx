import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconPlus } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import type { NewChatButtonColors } from '../../models/panel-props';
import styles from './NewChatButton.module.scss';

/** Props for `NewChatButton`. */
export interface NewChatButtonProps {
  /** Button label text (e.g. `"New chat"`). */
  label: string;
  /** Called when the button is clicked. */
  onClick: () => void;
  /** Typography class applied to the label. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: NewChatButtonColors;
}

/** Full-width button rendered at the top of the conversation panel to start a new chat. */
export const NewChatButton: FC<NewChatButtonProps> = memo(
  ({ label, onClick, labelClassName = 'dial-small-semi-text', colors }) => {
    const cssVars = buildCssVars({
      '--cp-new-chat-bg': colors?.background,
      '--cp-new-chat-text': colors?.text,
      '--cp-new-chat-focus-outline': colors?.focusOutline,
    });

    return (
      <div className="px-3 py-2" style={cssVars}>
        <button
          onClick={onClick}
          type="button"
          className={mergeClasses(
            'flex h-[36px] w-full cursor-pointer items-center justify-center gap-2 rounded-full px-3 py-1 shadow-sm hover:shadow-md active:shadow-xs',
            styles.button,
          )}
        >
          <IconPlus size={18} stroke={2} className="shrink-0" />
          <span className={labelClassName}>{label}</span>
        </button>
      </div>
    );
  },
);
