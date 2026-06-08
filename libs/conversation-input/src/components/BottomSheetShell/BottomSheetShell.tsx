import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE, DialCloseButton } from '@epam/ai-dial-ui-kit';
import type { CSSProperties, FC, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import styles from './BottomSheetShell.module.scss';

/** Props for the shared bottom-sheet overlay shell. */
export interface BottomSheetShellProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Heading text rendered in the sheet header and used as the dialog accessible name. */
  title: string;
  /** Accessible label for the close (×) button. */
  closeLabel: string;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** Typography class applied to the sheet title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** Extra classes appended to the sheet container (e.g. a max-height constraint). */
  className?: string;
  /** Sheet body rendered below the header divider. */
  children: ReactNode;
}

/**
 * Generic mobile bottom-sheet shell: renders a portal with a backdrop, a fixed
 * bottom-anchored panel, a centered header with a close button, and a divider.
 * Handles Escape-to-close and body scroll locking. Consumers supply the body.
 */
export const BottomSheetShell: FC<BottomSheetShellProps> = ({
  isOpen,
  title,
  closeLabel,
  onClose,
  style,
  titleClassName = 'dial-body-semi-bold-text',
  className,
  children,
}) => {
  useBottomSheet(isOpen, onClose);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="bg-black/50 fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        style={style}
        className={mergeClasses(
          styles.sheet,
          'fixed inset-x-0 bottom-0 z-50 flex flex-col',
          className,
        )}
      >
        {/* Header: title centered, close button pinned right */}
        <div className="relative flex h-[60px] flex-shrink-0 items-center justify-center px-4">
          <span className={mergeClasses(styles.title, titleClassName)}>
            {title}
          </span>
          <div className="absolute end-2">
            <DialCloseButton
              ariaLabel={closeLabel}
              size={BASE_ICON_SIZE}
              onClose={onClose}
            />
          </div>
        </div>
        <div className={mergeClasses(styles.divider, 'h-px flex-shrink-0')} />
        {children}
      </div>
    </>,
    document.body,
  );
};
