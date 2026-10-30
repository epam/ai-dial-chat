import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE, ToggleChip } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import styles from './ToolsChips.module.scss';

/** Typography overrides for the `ToolsChips` component. */
interface ToolsChipsTypography {
  /** Typography utility class applied to the chip text. Defaults to `'dial-small-paragraph-text'`. */
  fontClassName?: string;
  /** Typography utility class applied to the on/off state text. Defaults to `'dial-tiny-lead-text'`. */
  stateClassName?: string;
}

/** Color overrides for the `ToolsChips` component, applied as CSS custom properties. */
interface ToolsChipsColors {
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
  /** Chip background color on hover/focus while the tool is on. Defaults to `--bg-control-accent-alpha-hover`. */
  chipSelectedHoverBg?: string;
  /** Chip border color while the tool is on. Defaults to `--stroke-accent`. */
  chipSelectedBorder?: string;
  /** Chip leading-icon color while the tool is on. Defaults to `--text-accent`. */
  chipSelectedIcon?: string;
  /** Chip label text color while the tool is on. Defaults to `--text-accent`. */
  chipSelectedText?: string;
  /** Color of the chip's ON/OFF state text while the tool is off. Defaults to `--text-secondary`; while on it follows `chipSelectedText`. */
  chipStateText?: string;
  /** Icon color of the chip's × button. Defaults to `--text-secondary`, or `--text-accent` while the tool is on. Applies only while `canRemove` is `true`. */
  chipClose?: string;
  /** Icon color of the chip's × button on hover/focus. Defaults to `--text-primary`. Applies only while `canRemove` is `true`. */
  chipCloseHover?: string;
}

const defaultRemoveLabel = (label: string): string => `Remove ${label}`;

/** Props for the ToolsChips component. */
export interface ToolsChipsProps {
  /** Tools to render, each as a toggle chip reflecting its `isSelected` state. */
  items: ToolMenuItem[];
  /** Called with the tool id when a chip body is clicked. */
  onToolToggle: (toolId: string) => void;
  /** Called with the tool id when the chip's × is clicked, to drop it from the row. Ignored while `canRemove` is `false`. */
  onToolDismiss: (toolId: string) => void;
  /** When `false`, chips render as the kit `ToggleChip` without a × and cannot be dropped from the row. Defaults to `true`. */
  canRemove?: boolean;
  /** Returns the accessible label for a chip's × button. Defaults to `"Remove {toolLabel}"`. */
  removeLabel?: (toolLabel: string) => string;
  /**
   * Visible state text appended after the tool label, e.g. `"ON"` while the
   * tool is selected. The state renders only when both `stateOnLabel` and
   * `stateOffLabel` are provided; it is visual only, since the chip already
   * announces its state through `aria-pressed`.
   */
  stateOnLabel?: string;
  /** Visible state text appended after the tool label while the tool is off, e.g. `"OFF"`. See `stateOnLabel`. */
  stateOffLabel?: string;
  /** Typography overrides for the chip text. */
  typography?: ToolsChipsTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: ToolsChipsColors;
}

/**
 * Toggle chips for the tools the active deployment exposes, rendered inside the
 * conversation input. Clicking a chip flips the tool between neutral (off) and
 * accent (on) styling; when `canRemove` is set, clicking its × drops the chip
 * from the row.
 */
export const ToolsChips: FC<ToolsChipsProps> = ({
  items,
  onToolToggle,
  onToolDismiss,
  canRemove = true,
  removeLabel = defaultRemoveLabel,
  stateOnLabel,
  stateOffLabel,
  typography,
  colors,
}) => {
  if (items.length === 0) return null;

  const showState = Boolean(stateOnLabel && stateOffLabel);

  const cssVars = buildCssVars({
    '--ci-chip-bg': colors?.chipBg,
    '--ci-chip-border': colors?.chipBorder,
    '--ci-chip-icon': colors?.chipIcon,
    '--ci-chip-text': colors?.chipText,
    '--ci-chip-hover-bg': colors?.chipHoverBg,
    '--ci-chip-selected-bg': colors?.chipSelectedBg,
    '--ci-chip-selected-bg-hover': colors?.chipSelectedHoverBg,
    '--ci-chip-selected-border': colors?.chipSelectedBorder,
    '--ci-chip-selected-icon': colors?.chipSelectedIcon,
    '--ci-chip-selected-text': colors?.chipSelectedText,
    '--ci-chip-state-text': colors?.chipStateText,
    '--ci-chip-close': colors?.chipClose,
    '--ci-chip-close-hover': colors?.chipCloseHover,
  });

  const renderIcon = (item: ToolMenuItem) => (
    <span className={mergeClasses(styles.chipIcon, 'flex shrink-0')}>
      {item.icon}
    </span>
  );

  const renderLabel = (item: ToolMenuItem) => (
    <span className="flex min-w-0 items-center">
      <span
        className={mergeClasses(
          styles.chipText,
          typography?.fontClassName || 'dial-small-paragraph-text',
          'truncate',
        )}
      >
        {item.label}
        {showState && <span aria-hidden>:</span>}
      </span>
      {showState && (
        <span
          className={mergeClasses(
            styles.chipState,
            typography?.stateClassName || 'dial-tiny-lead-text',
            'ms-1 shrink-0',
          )}
          aria-hidden
        >
          {item.isSelected ? stateOnLabel : stateOffLabel}
        </span>
      )}
    </span>
  );

  return (
    <div className="flex flex-wrap items-center gap-2" style={cssVars}>
      {items.map((item) => {
        if (!canRemove) {
          /* The kit chip owns the toggle semantics. The module classes keep the
             `colors` contract, and the geometry overrides match the removable
             chip below, so the row looks the same in either mode. */
          return (
            <ToggleChip
              key={item.id}
              icon={renderIcon(item)}
              label={renderLabel(item)}
              isSelected={item.isSelected}
              onToggle={() => onToolToggle(item.id)}
              className={mergeClasses(
                styles.chip,
                item.isSelected && styles.chipSelected,
                'h-auto min-w-0 gap-1.5 border px-2 py-1 transition-colors',
              )}
            />
          );
        }

        /* `ToggleChip` has no remove control, so a removable chip stays
           hand-rolled: the toggle and the × are two sibling buttons. */
        return (
          <div
            key={item.id}
            className={mergeClasses(
              styles.chip,
              item.isSelected && styles.chipSelected,
              'flex min-w-0 items-center gap-1.5 rounded-full border py-1 ps-2 pe-1 transition-colors',
            )}
          >
            <button
              type="button"
              onClick={() => onToolToggle(item.id)}
              aria-pressed={item.isSelected}
              className="flex min-w-0 items-center gap-1.5"
            >
              <span className="flex shrink-0" aria-hidden>
                {renderIcon(item)}
              </span>
              {renderLabel(item)}
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
              <IconX size={12} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
