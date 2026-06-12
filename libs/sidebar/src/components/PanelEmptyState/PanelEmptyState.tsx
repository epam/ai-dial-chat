import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, useMemo, type FC, type ReactNode } from 'react';
import styles from './PanelEmptyState.module.scss';

/** Props for `PanelEmptyState`. */
export interface PanelEmptyStateProps {
  /** Icon element rendered above the label. */
  icon: ReactNode;
  /** Primary message shown beneath the icon. */
  label: string;
  /** CSS color value (including `var(--token)`) for the icon. Falls back to `--text-secondary`. */
  iconColor?: string;
  /** CSS color value (including `var(--token)`) for the label text. Falls back to `--text-primary`. */
  labelColor?: string;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
}

/** Centered empty-state block for use inside a sidebar panel body. */
export const PanelEmptyState: FC<PanelEmptyStateProps> = memo(
  ({
    icon,
    label,
    iconColor,
    labelColor,
    labelClassName = 'dial-small-text',
  }) => {
    const cssVars = useMemo(
      () =>
        buildCssVars({
          '--pes-icon-color': iconColor,
          '--pes-label-color': labelColor,
        }),
      [iconColor, labelColor],
    );

    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-2"
        style={cssVars}
      >
        <span className={styles.icon}>{icon}</span>
        <p
          className={mergeClasses('text-center', styles.label, labelClassName)}
        >
          {label}
        </p>
      </div>
    );
  },
);
