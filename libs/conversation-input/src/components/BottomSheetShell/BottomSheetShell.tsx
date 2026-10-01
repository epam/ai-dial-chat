import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { BottomSheet } from '@epam/ai-dial-ui-kit';
import { type CSSProperties, type FC, type ReactNode } from 'react';
import styles from './BottomSheetShell.module.scss';

/** Color overrides for the `BottomSheetShell` component, applied as CSS custom properties. */
export interface BottomSheetShellColors {
  /** Backdrop background color. Defaults to `--bg-backdrop`. */
  backdrop?: string;
  /** Sheet panel background color. Defaults to `--bg-layer-raised`. */
  sheetBg?: string;
  /** Sheet title text color. Defaults to `--text-primary`. */
  sheetText?: string;
  /** Divider line color below the header. Defaults to `--stroke-tertiary`. */
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
  /** Inline CSS custom properties forwarded to the sheet panel for theming. */
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

/** Mobile bottom sheet drawn by the UI kit's `BottomSheet`, themed through `BottomSheetShellColors`. */
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
  const cssVars = buildCssVars({
    '--ci-backdrop': colors?.backdrop,
    '--ci-sheet-bg': colors?.sheetBg,
    '--ci-sheet-text': colors?.sheetText,
    '--ci-sheet-divider': colors?.divider,
  });

  /*
   * The sheet renders in a portal, so the colour variables travel on the
   * panel and the backdrop themselves; a caller's \`style\` lands on the panel
   * after them, as it always did.
   */
  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      title={title}
      ariaLabel={ariaLabel}
      onBack={onBack}
      backAriaLabel={backLabel}
      closeAriaLabel={closeLabel}
      style={{ ...cssVars, ...style }}
      overlayStyle={cssVars}
      className={mergeClasses(styles.sheet, className)}
      overlayClassName={styles.backdrop}
      headerClassName={styles.divider}
      titleClassName={mergeClasses(styles.title, titleClassName)}
    >
      {children}
    </BottomSheet>
  );
};
