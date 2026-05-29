import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  BASE_ICON_SIZE,
  DialButton,
  DialCloseButton,
} from '@epam/ai-dial-ui-kit';
import { type CSSProperties, type FC, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
 * Renders via a React portal so it sits above all other content.
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
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleItemClick = (onClick: () => void) => {
    onClick();
    onClose();
  };

  return createPortal(
    <>
      <div
        className="bg-black/50 fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        style={style}
        className={mergeClasses(
          styles.sheet,
          'fixed bottom-0 left-0 right-0 z-50 flex flex-col',
        )}
      >
        {/* Header: title centered, close button pinned right */}
        <div className="relative flex h-[60px] items-center justify-center gap-3 pb-2 pl-4 pr-4 pt-3">
          <span className={mergeClasses(styles.title, titleClassName)}>
            {title}
          </span>
          <div className="absolute right-2">
            <DialCloseButton
              ariaLabel={closeLabel}
              size={BASE_ICON_SIZE}
              onClose={onClose}
            />
          </div>
        </div>
        <div className={mergeClasses(styles.divider, 'h-px')} />
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
      </div>
    </>,
    document.body,
  );
};
