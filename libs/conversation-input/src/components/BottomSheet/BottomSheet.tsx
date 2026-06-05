import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';
import type { CSSProperties, FC, ReactNode } from 'react';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell.js';
import styles from './BottomSheet.module.scss';

/** A single action entry in the bottom-sheet menu. */
export interface BottomSheetItem {
  /** Unique identifier for the item. */
  key: string;
  /** Display label. */
  label: string;
  /** Leading icon element. */
  icon: ReactNode;
  /** Invoked when the item is tapped; the sheet closes automatically after. */
  onClick: () => void;
}

/** Props for the generic mobile bottom-sheet menu. */
export interface BottomSheetProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Heading text rendered in the sheet header. */
  title: string;
  /** Accessible label for the close (×) button. */
  closeLabel: string;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** Actions displayed in the sheet body. */
  items: BottomSheetItem[];
  /** Typography class applied to the sheet title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** Typography class applied to each item label. Defaults to `'dial-small-text'`. */
  itemLabelClassName?: string;
}

/**
 * A generic bottom-sheet overlay for mobile viewports.
 * Renders the shared {@link BottomSheetShell} with a list of tappable actions.
 */
export const BottomSheet: FC<BottomSheetProps> = ({
  isOpen,
  title,
  closeLabel,
  onClose,
  style,
  items,
  titleClassName = 'dial-body-semi-bold-text',
  itemLabelClassName = 'dial-small-text',
}) => {
  const handleItemClick = (onClick: () => void) => {
    onClick();
    onClose();
  };

  return (
    <BottomSheetShell
      isOpen={isOpen}
      title={title}
      closeLabel={closeLabel}
      onClose={onClose}
      style={style}
      titleClassName={titleClassName}
    >
      <ul role="list" className="flex flex-col">
        {items.map(({ key, label, icon, onClick }) => (
          <li key={key}>
            <DialButton
              type="button"
              className={mergeClasses(
                styles.item,
                'flex w-full items-center gap-3 px-4 py-[10px] text-left',
              )}
              iconBefore={<span className={styles.itemIcon}>{icon}</span>}
              label={<span className={itemLabelClassName}>{label}</span>}
              onClick={() => handleItemClick(onClick)}
            />
          </li>
        ))}
      </ul>
    </BottomSheetShell>
  );
};
