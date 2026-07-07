import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';
import type { CSSProperties, FC, ReactNode } from 'react';
import { BottomSheetShell } from '../BottomSheetShell/BottomSheetShell';
import styles from './BottomSheet.module.scss';

/** A single action entry in the bottom-sheet menu. */
export interface BottomSheetItem {
  /** Unique identifier for the item. */
  key: string;
  /** Display label. */
  label: string;
  /** Leading icon element. */
  icon: ReactNode;
  /** Optional trailing icon element. */
  iconAfter?: ReactNode;
  /** CSS class applied to the item button text. Defaults to empty string */
  textClassName?: string;
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
  /** Extra classes appended to the sheet container (e.g. a max-height constraint). */
  className?: string;
  /** CSS class applied to the sheet title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** CSS class applied to each item label. Defaults to `'dial-small-text'`. */
  itemLabelClassName?: string;
  /** CSS class applied to each item button text. Defaults to empty string */
  btnTextClassName?: string;
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
  className,
  titleClassName = 'dial-body-semi-text',
  itemLabelClassName = 'dial-small-text',
  btnTextClassName = '',
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
      className={className}
      titleClassName={titleClassName}
    >
      <ul role="list" className="flex flex-col">
        {items.map(({ key, label, icon, iconAfter, onClick }) => (
          <li key={key}>
            <DialButton
              type="button"
              className={mergeClasses(
                styles.item,
                'flex w-full items-center gap-3 px-4 py-[10px] text-left',
              )}
              iconBefore={<span className={styles.itemIcon}>{icon}</span>}
              iconAfter={
                iconAfter ? <span className="ml-auto">{iconAfter}</span> : null
              }
              textClassName={btnTextClassName}
              label={<span className={itemLabelClassName}>{label}</span>}
              onClick={() => handleItemClick(onClick)}
            />
          </li>
        ))}
      </ul>
    </BottomSheetShell>
  );
};
