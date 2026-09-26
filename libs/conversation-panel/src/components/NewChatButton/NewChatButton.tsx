import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { Button, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconPlus } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { CONVERSATION_PANEL_CLASS } from '../../constants/public-class-names';
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
  /**
   * Extra class name(s) merged onto the button. The button is `h-[36px]` with
   * the `shadow-chat-button` elevation by default, and both are merged rather
   * than fixed, so a `h-*` or `shadow-*` utility passed here replaces them.
   * The corner radius is not a class: it reads the kit's `--radius-control`.
   */
  className?: string;
}

/** Full-width button rendered at the top of the conversation panel to start a new chat. */
export const NewChatButton: FC<NewChatButtonProps> = memo(
  ({
    label,
    onClick,
    labelClassName = 'dial-small-semi-text',
    colors,
    className,
  }) => {
    const cssVars = buildCssVars({
      '--cp-new-chat-bg': colors?.background,
      '--cp-new-chat-text': colors?.text,
      '--cp-new-chat-focus-outline': colors?.focusOutline,
    });

    return (
      <div className="px-3 py-2" style={cssVars}>
        {/* No `variant`: the kit then paints no background or text colour of
            its own, so the colours stay on this package's custom properties. */}
        <Button
          label={label}
          textClassName={labelClassName}
          iconBefore={
            <IconPlus
              size={18}
              stroke={DIAL_KIT_ICON_STROKE}
              className="shrink-0"
              aria-hidden
            />
          }
          onClick={onClick}
          className={mergeClasses(
            'h-[36px] w-full gap-2 px-3 py-1 shadow-chat-button hover:shadow-xs focus-visible:shadow-xs active:shadow-xs',
            styles.button,
            className,
            CONVERSATION_PANEL_CLASS.newChatButton,
          )}
        />
      </div>
    );
  },
);
