import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DialCloseButton,
  DialGhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import type { CSSProperties, FC, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import styles from './BottomSheetShell.module.scss';

/** Props for the shared bottom-sheet overlay shell. */
export interface BottomSheetShellProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /**
   * Heading text rendered in the sheet header and used as the dialog
   * accessible name. When omitted the header is hidden entirely.
   */
  title?: string;
  /** Accessible label for the close (×) button. Required when `title` is provided. */
  closeLabel?: string;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** When provided, a back-arrow button is shown at the start of the header. */
  onBack?: () => void;
  /** Accessible label for the back button. Required when `onBack` is provided. */
  backLabel?: string;
  /**
   * Accessible name for the dialog when no `title` is shown.
   * Ignored when `title` is present (title doubles as the accessible name).
   */
  'aria-label'?: string;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** CSS class applied to the sheet title. Defaults to `'dial-body-semi-bold-text'`. */
  titleClassName?: string;
  /** Extra classes appended to the sheet container (e.g. a max-height constraint). */
  className?: string;
  /** Sheet body rendered below the header divider. */
  children: ReactNode;
}

/**
 * Generic mobile bottom-sheet shell: renders a portal with a backdrop, a fixed
 * bottom-anchored panel, and an optional header. Handles Escape-to-close and
 * body scroll locking. Consumers supply the body.
 */
export const BottomSheetShell: FC<BottomSheetShellProps> = ({
  isOpen,
  title,
  closeLabel,
  onClose,
  onBack,
  backLabel,
  'aria-label': ariaLabel,
  style,
  titleClassName = 'dial-body-semi-text',
  className,
  children,
}) => {
  useBottomSheet(isOpen, onClose);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop — onPointerDown avoids the touch-synthesized ghost click */}
      <div
        className={mergeClasses(styles.backdrop, 'fixed inset-0 z-[55]')}
        onPointerDown={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label={title ?? ariaLabel}
        style={style}
        className={mergeClasses(
          styles.sheet,
          'fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col',
          className,
        )}
      >
        {title != null && (
          <>
            {/* Header: optional back on start, title centered, close on end */}
            <div className="relative flex h-[60px] flex-shrink-0 items-center justify-center px-4">
              {onBack && (
                <div className="absolute start-4">
                  <DialGhostIconButton
                    icon={
                      <IconArrowLeft
                        size={DIAL_ICON_SIZE.LG}
                        stroke={1.5}
                        className="rtl:scale-x-[-1]"
                      />
                    }
                    aria-label={backLabel}
                    onClick={onBack}
                  />
                </div>
              )}
              <span className={mergeClasses(styles.title, titleClassName)}>
                {title}
              </span>
              <div className="absolute end-4 m-2">
                <DialCloseButton
                  ariaLabel={closeLabel}
                  size={DIAL_ICON_SIZE.LG}
                  onClose={onClose}
                />
              </div>
            </div>
            <div className="h-px flex-shrink-0" />
          </>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </>,
    document.body,
  );
};
