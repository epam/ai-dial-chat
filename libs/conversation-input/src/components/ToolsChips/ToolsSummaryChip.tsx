import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconTool } from '@tabler/icons-react';
import type { FC } from 'react';
import styles from './ToolsChips.module.scss';

const defaultSummaryLabel = (selectedCount: number, totalCount: number) =>
  `Tools: ${selectedCount} of ${totalCount} on`;

/** Props for the ToolsSummaryChip component. */
export interface ToolsSummaryChipProps {
  /** Every tool the deployment exposes; the chip counts the selected ones. */
  items: ToolMenuItem[];
  /** Visible chip text. Defaults to `'Tools'`. */
  title?: string;
  /** Accessible name of the chip. Defaults to `"Tools: {selected} of {total} on"`. */
  summaryLabel?: (selectedCount: number, totalCount: number) => string;
  /** Called when the chip is tapped — opens the tools sheet. */
  onClick: () => void;
  /** Typography utility class applied to the chip text. Defaults to `'dial-small-paragraph-text'`. */
  fontClassName?: string;
  /** Typography utility class applied to the count. Defaults to `'dial-tiny-lead-text'`. */
  countClassName?: string;
}

/**
 * The phone presentation of the tools row: one chip with the number of
 * switched-on tools instead of a chip per tool, which does not fit a phone
 * composer (#9618). Tapping it opens the tools sheet. It shares the
 * `ToolsChips` color contract and takes the accent styling while any tool is on.
 */
export const ToolsSummaryChip: FC<ToolsSummaryChipProps> = ({
  items,
  title = 'Tools',
  summaryLabel = defaultSummaryLabel,
  onClick,
  fontClassName = 'dial-small-paragraph-text',
  countClassName = 'dial-tiny-lead-text',
}) => {
  if (items.length === 0) return null;

  const selectedCount = items.filter((item) => item.isSelected).length;
  const hasSelected = selectedCount > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={summaryLabel(selectedCount, items.length)}
      className={mergeClasses(
        styles.chip,
        hasSelected && styles.chipSelected,
        'flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 transition-colors',
      )}
    >
      <span className={mergeClasses(styles.chipIcon, 'flex shrink-0')}>
        <IconTool size={16} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />
      </span>
      <span
        className={mergeClasses(styles.chipText, fontClassName, 'truncate')}
        aria-hidden
      >
        {title}
      </span>
      {hasSelected && (
        <span
          className={mergeClasses(styles.chipState, countClassName, 'shrink-0')}
          aria-hidden
        >
          {selectedCount}
        </span>
      )}
    </button>
  );
};
