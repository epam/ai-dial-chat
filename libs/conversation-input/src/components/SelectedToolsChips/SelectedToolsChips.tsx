import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconTool, IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import styles from './SelectedToolsChips.module.scss';

/** Typography overrides for the `SelectedToolsChips` component. */
export interface SelectedToolsChipsTypography {
  /** Typography utility class applied to the chip text. Defaults to `'dial-small-paragraph-text'`. */
  fontClassName?: string;
}

/** Color overrides for the `SelectedToolsChips` component, applied as CSS custom properties. */
export interface SelectedToolsChipsColors {
  /** Chip background color. Defaults to `--bg-layer-base`. */
  chipBg?: string;
  /** Chip border color. Defaults to `--stroke-secondary`. */
  chipBorder?: string;
  /** Chip leading-icon color. Defaults to `--text-secondary`. */
  chipIcon?: string;
  /** Chip label text color. Defaults to `--text-primary`. */
  chipText?: string;
  /** Close (×) button icon color. Defaults to `--text-secondary`. */
  chipClose?: string;
  /** Close (×) button icon color on hover/focus. Defaults to `--text-primary`. */
  chipCloseHover?: string;
}

/** Props for the SelectedToolsChips component. */
export interface SelectedToolsChipsProps {
  /** All tool menu items; the component filters by `isSelected` internally. */
  items: ToolMenuItem[];
  /** Called with the tool id when the close button is clicked on a desktop chip. */
  onToolToggle: (toolId: string) => void;
  /** Whether to render the mobile (consolidated) chip or desktop (individual) chips. */
  isMobile: boolean;
  /** Formats the consolidated count label shown in the mobile chip when two or more tools are selected. Defaults to English pluralization. */
  countLabel?: (count: number) => string;
  /** Returns the accessible label for the close button on a desktop chip. Defaults to `"Remove {toolLabel}"`. */
  removeLabel?: (toolLabel: string) => string;
  /** Typography overrides for the chip text. */
  typography?: SelectedToolsChipsTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: SelectedToolsChipsColors;
}

const defaultCountLabel = (n: number): string =>
  `${n} tool${n !== 1 ? 's' : ''}`;

const defaultRemoveLabel = (label: string): string => `Remove ${label}`;

/** Chip row rendered inside the conversation input when one or more tools are selected. */
export const SelectedToolsChips: FC<SelectedToolsChipsProps> = ({
  items,
  onToolToggle,
  isMobile,
  countLabel = defaultCountLabel,
  removeLabel = defaultRemoveLabel,
  typography,
  colors,
}) => {
  const selectedItems = items.filter((item) => item.isSelected);

  if (selectedItems.length === 0) return null;

  const cssVars = buildCssVars({
    '--ci-chip-bg': colors?.chipBg,
    '--ci-chip-border': colors?.chipBorder,
    '--ci-chip-icon': colors?.chipIcon,
    '--ci-chip-text': colors?.chipText,
    '--ci-chip-close': colors?.chipClose,
    '--ci-chip-close-hover': colors?.chipCloseHover,
  });

  if (isMobile) {
    const isSingleSelection = selectedItems.length === 1;
    const mobileIcon = isSingleSelection ? (
      selectedItems[0].icon
    ) : (
      <IconTool size={BASE_ICON_SIZE} aria-hidden />
    );
    /* A lone selection names the tool; only a multi-selection collapses to a count. */
    const mobileLabel = isSingleSelection
      ? selectedItems[0].label
      : countLabel(selectedItems.length);

    return (
      <div className="flex flex-wrap items-center gap-2" style={cssVars}>
        <div
          className={mergeClasses(
            styles.chip,
            'flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1',
          )}
        >
          <span
            className={mergeClasses(styles.chipIcon, 'shrink-0')}
            aria-hidden
          >
            {mobileIcon}
          </span>
          <span
            className={mergeClasses(
              styles.chipText,
              typography?.fontClassName || 'dial-small-paragraph-text',
              'truncate',
            )}
          >
            {mobileLabel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" style={cssVars}>
      {selectedItems.map((item) => (
        <div
          key={item.id}
          className={mergeClasses(
            styles.chip,
            'flex items-center gap-1.5 rounded-full border py-1 pe-1 ps-2',
          )}
        >
          <span className={styles.chipIcon} aria-hidden>
            {item.icon}
          </span>
          <span
            className={mergeClasses(
              styles.chipText,
              typography?.fontClassName || 'dial-small-paragraph-text',
            )}
          >
            {item.label}
          </span>
          <button
            type="button"
            onClick={() => onToolToggle(item.id)}
            className={mergeClasses(
              styles.chipClose,
              'flex items-center rounded p-0.5 transition-colors',
            )}
            aria-label={removeLabel(item.label)}
          >
            <IconX size={12} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
};
