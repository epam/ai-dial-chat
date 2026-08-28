import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconCheck } from '@tabler/icons-react';
import { memo, type FC, type ReactNode } from 'react';
import styles from './MenuPrimitives.module.scss';

/** Props for `MenuItemLabel`. */
export interface MenuItemLabelProps {
  /** Translated option label. */
  label: string;
  /** Whether the option is the applied value; renders a trailing check mark. */
  isActive: boolean;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** CSS class controlling the label's type scale. Defaults to `'dial-small-text'`. */
  textClassName?: string;
}

/** Dropdown row label with an optional leading icon and an active check mark. */
export const MenuItemLabel: FC<MenuItemLabelProps> = memo(
  ({ label, isActive, icon, textClassName = 'dial-small-text' }) => {
    const text = (
      <span className={mergeClasses(styles.label, 'truncate', textClassName)}>
        {label}
      </span>
    );

    return (
      <span className="flex items-center justify-between gap-4">
        {icon ? (
          <span className="flex items-center gap-2">
            {icon}
            {text}
          </span>
        ) : (
          text
        )}
        {isActive && (
          <IconCheck
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            className={styles.activeIcon}
            stroke={DIAL_KIT_ICON_STROKE}
          />
        )}
      </span>
    );
  },
);
