import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  CloseButton,
  GhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import type { CSSProperties, FC, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import styles from './BottomSheetShell.module.scss';

/** Color overrides for the `BottomSheetShell` component, applied as CSS custom properties. */
export interface BottomSheetShellColors {
  /** Backdrop background color. Defaults to `--bg-backdrop`. */
  backdrop?: string;
  /** Sheet panel background color. Defaults to `--bg-layer-raised`. */
  sheetBg?: string;
  /** Sheet title text color. Defaults to `--text-primary`. */
  sheetText?: string;
  /** Divider line color below the header. Defaults to `--bg-layer-4`. */
  divider?: string;
}

/** Props for the shared bottom-sheet overlay shell. */
export interface BottomSheetShellProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Heading text for the sheet header and dialog accessible name; header hidden when omitted. */
  title?: string;
  /** Accessible label for the close (×) button. Required when `title` is provided. */
  closeLabel?: string;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** When provided, a back-arrow button is shown at the start of the header. */
  onBack?: () => void;
  /** Accessible label for the back button. Required when `onBack` is provided. */
  backLabel?: string;
  /** Dialog accessible name used when `title` is omitted. */
  'aria-label'?: string;
  /** Inline CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
  /** CSS class applied to the sheet title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Extra classes appended to the sheet container (e.g. a max-height constraint). */
  className?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: BottomSheetShellColors;
  /** Sheet body rendered below the header divider. */
  children: ReactNode;
}

/** Generic mobile bottom-sheet shell: backdrop, bottom-anchored panel, optional header, Escape-to-close, and body-scroll lock. */
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
  colors,
  children,
}) => {
  useBottomSheet(isOpen, onClose);

  if (!isOpen || typeof document === 'undefined') return null;

  const cssVars = buildCssVars({
    '--ci-backdrop': colors?.backdrop,
    '--ci-sheet-bg': colors?.sheetBg,
    '--ci-sheet-text': colors?.sheetText,
    '--ci-sheet-divider': colors?.divider,
  });

  return createPortal(
    <>
      {/* Backdrop — onPointerDown avoids the touch-synthesized ghost click */}
      <div
        className={mergeClasses(styles.backdrop, 'fixed inset-0 z-[55]')}
        style={cssVars}
        onPointerDown={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal
        aria-label={title ?? ariaLabel}
        style={{ ...cssVars, ...style }}
        className={mergeClasses(
          styles.sheet,
          'fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col rounded-t-lg',
          className,
        )}
      >
        {title != null && (
          <>
            {/* Header: optional back on start, title centered, close on end */}
            <div className="relative flex h-[60px] flex-shrink-0 items-center justify-center px-4">
              {onBack && (
                <div className="absolute start-4">
                  <GhostIconButton
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
                <CloseButton
                  ariaLabel={closeLabel}
                  onClose={onClose}
                  size={ElementSize.Standard}
                />
              </div>
            </div>
            <div
              className={mergeClasses(styles.divider, 'h-px flex-shrink-0')}
            />
          </>
        )}
        <div className="overflow-y-auto">{children}</div>
      </div>
    </>,
    document.body,
  );
};
