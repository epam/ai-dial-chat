import type { ToolMenuItem } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconTool, IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import styles from './SelectedToolsChips.module.scss';

/** Props for the SelectedToolsChips component. */
export interface SelectedToolsChipsProps {
  /** All tool menu items; the component filters by `isSelected` internally. */
  items: ToolMenuItem[];
  /** Called with the tool id when the close button is clicked on a desktop chip. */
  onToolToggle: (toolId: string) => void;
  /** Whether to render the mobile (consolidated) chip or desktop (individual) chips. */
  isMobile: boolean;
  /** Formats the consolidated count label shown in the mobile chip. Defaults to English pluralization. */
  countLabel?: (count: number) => string;
  /** Returns the accessible label for the close button on a desktop chip. Defaults to `"Remove {toolLabel}"`. */
  removeLabel?: (toolLabel: string) => string;
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
}) => {
  const selectedItems = items.filter((item) => item.isSelected);

  if (selectedItems.length === 0) return null;

  if (isMobile) {
    const mobileIcon =
      selectedItems.length === 1 ? (
        selectedItems[0].icon
      ) : (
        <IconTool size={BASE_ICON_SIZE} aria-hidden />
      );

    return (
      <div className="flex flex-wrap items-center gap-2">
        <div
          className={mergeClasses(
            styles.chip,
            'flex items-center gap-1.5 rounded border px-2 py-1',
          )}
        >
          <span className={styles.chipIcon} aria-hidden>
            {mobileIcon}
          </span>
          <span className={mergeClasses(styles.chipText, 'dial-small-text')}>
            {countLabel(selectedItems.length)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedItems.map((item) => (
        <div
          key={item.id}
          className={mergeClasses(
            styles.chip,
            'flex items-center gap-1.5 rounded border py-1 pe-1 ps-2',
          )}
        >
          <span className={styles.chipIcon} aria-hidden>
            {item.icon}
          </span>
          <span className={mergeClasses(styles.chipText, 'dial-small-text')}>
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
