import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconX } from '@tabler/icons-react';
import type { FC } from 'react';
import type {
  SelectedEntityChip,
  SelectedEntityChipsLabels,
} from '../../models/Input';
import styles from './SelectedEntityChips.module.scss';

const defaultRemoveLabel = (label: string): string => `Remove ${label}`;

/** Props for the SelectedEntityChips component. */
export interface SelectedEntityChipsProps {
  /** Selected entities to render, each as a removable chip. */
  items: SelectedEntityChip[];
  /** Returns the accessible label for a chip's × button, which removes the entity. Defaults to `"Remove {label}"`. */
  removeLabel?: SelectedEntityChipsLabels['removeLabel'];
  /** Typography utility class applied to the chip text. Defaults to `'dial-small-paragraph-text'`. */
  fontClassName?: string;
}

/**
 * Removable chips for host-selected entities (e.g. a picked skill), rendered
 * where the tool chips render. The chip body is plain presentation — only
 * its × is a control.
 */
export const SelectedEntityChips: FC<SelectedEntityChipsProps> = ({
  items,
  removeLabel = defaultRemoveLabel,
  fontClassName = 'dial-small-paragraph-text',
}) => {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={mergeClasses(
            styles.chip,
            'flex min-w-0 items-center gap-1.5 rounded-full border py-1 pe-1 ps-2 transition-colors',
          )}
        >
          {item.icon != null && (
            <span
              className={mergeClasses(styles.chipIcon, 'shrink-0')}
              aria-hidden
            >
              {item.icon}
            </span>
          )}
          <span
            className={mergeClasses(styles.chipText, fontClassName, 'truncate')}
          >
            {item.label}
          </span>
          <button
            type="button"
            onClick={item.onRemove}
            aria-label={removeLabel(item.label)}
            className={mergeClasses(
              styles.chipClose,
              'flex shrink-0 items-center rounded p-0.5 transition-colors',
            )}
          >
            <IconX size={12} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />
          </button>
        </div>
      ))}
    </div>
  );
};
