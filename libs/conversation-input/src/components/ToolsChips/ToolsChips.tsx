import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import styles from './ToolsChips.module.scss';

/** Typography overrides for the `ToolsChips` component. */
export interface ToolsChipsTypography {
  /** Typography utility class applied to the chip text. Defaults to `'dial-small-paragraph-text'`. */
  fontClassName?: string;
}

/** Color overrides for the `ToolsChips` component, applied as CSS custom properties. */
export interface ToolsChipsColors {
  /** Chip background color while the tool is off. Defaults to `--bg-layer-base`. */
  chipBg?: string;
  /** Chip border color while the tool is off. Defaults to `--stroke-secondary`. */
  chipBorder?: string;
  /** Chip leading-icon color while the tool is off. Defaults to `--text-secondary`. */
  chipIcon?: string;
  /** Chip label text color while the tool is off. Defaults to `--text-primary`. */
  chipText?: string;
  /** Chip background color on hover/focus while the tool is off. Defaults to `--bg-control-neutral-hover-muted`. */
  chipHoverBg?: string;
  /** Chip background color while the tool is on. Defaults to `--bg-control-accent-alpha`. */
  chipSelectedBg?: string;
  /** Chip border color while the tool is on. Defaults to `--stroke-accent`. */
  chipSelectedBorder?: string;
  /** Chip leading-icon color while the tool is on. Defaults to `--text-accent`. */
  chipSelectedIcon?: string;
  /** Chip label text color while the tool is on. Defaults to `--text-accent`. */
  chipSelectedText?: string;
  /** Icon color of the chip's × button. Defaults to `--text-secondary`, or `--text-accent` while the tool is on. */
  chipClose?: string;
  /** Icon color of the chip's × button on hover/focus. Defaults to `--text-primary`. */
  chipCloseHover?: string;
}

const defaultRemoveLabel = (label: string): string => `Remove ${label}`;

/** Props for the ToolsChips component. */
export interface ToolsChipsProps {
  /** Tools to render, each as a toggle chip reflecting its `isSelected` state. */
  items: ToolMenuItem[];
  /** Called with the tool id when a chip body is clicked. */
  onToolToggle: (toolId: string) => void;
  /** Called with the tool id when the chip's × is clicked, to drop it from the row. */
  onToolDismiss: (toolId: string) => void;
  /** Returns the accessible label for a chip's × button. Defaults to `"Remove {toolLabel}"`. */
  removeLabel?: (toolLabel: string) => string;
  /** Typography overrides for the chip text. */
  typography?: ToolsChipsTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: ToolsChipsColors;
}

/**
 * Toggle chips for the tools the active deployment exposes, rendered inside the
 * conversation input. Clicking a chip flips the tool between neutral (off) and
 * accent (on) styling; clicking its × drops the chip from the row.
 */
export const ToolsChips: FC<ToolsChipsProps> = ({
  items,
  onToolToggle,
  onToolDismiss,
  removeLabel = defaultRemoveLabel,
  typography,
  colors,
}) => {
  if (items.length === 0) return null;

  const cssVars = buildCssVars({
    '--ci-chip-bg': colors?.chipBg,
    '--ci-chip-border': colors?.chipBorder,
    '--ci-chip-icon': colors?.chipIcon,
    '--ci-chip-text': colors?.chipText,
    '--ci-chip-hover-bg': colors?.chipHoverBg,
    '--ci-chip-selected-bg': colors?.chipSelectedBg,
    '--ci-chip-selected-border': colors?.chipSelectedBorder,
    '--ci-chip-selected-icon': colors?.chipSelectedIcon,
    '--ci-chip-selected-text': colors?.chipSelectedText,
    '--ci-chip-close': colors?.chipClose,
    '--ci-chip-close-hover': colors?.chipCloseHover,
  });

  return (
    <div className="flex flex-wrap items-center gap-2" style={cssVars}>
      {items.map((item) => (
        <div
          key={item.id}
          className={mergeClasses(
            styles.chip,
            item.isSelected && styles.chipSelected,
            'flex min-w-0 items-center gap-1.5 rounded-full border py-1 pe-1 ps-2 transition-colors',
          )}
        >
          <button
            type="button"
            onClick={() => onToolToggle(item.id)}
            aria-pressed={item.isSelected}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span
              className={mergeClasses(styles.chipIcon, 'shrink-0')}
              aria-hidden
            >
              {item.icon}
            </span>
            <span
              className={mergeClasses(
                styles.chipText,
                typography?.fontClassName || 'dial-small-paragraph-text',
                'truncate',
              )}
            >
              {item.label}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToolDismiss(item.id)}
            aria-label={removeLabel(item.label)}
            className={mergeClasses(
              styles.chipClose,
              'flex shrink-0 items-center rounded p-0.5 transition-colors',
            )}
          >
            <IconX size={12} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
};
