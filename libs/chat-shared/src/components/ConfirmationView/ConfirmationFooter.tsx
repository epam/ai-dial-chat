import {
  ConfirmationPopupVariant,
  DangerButton,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostButton,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconTrashX } from '@tabler/icons-react';
import { FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import styles from './ConfirmationView.module.scss';

/** Color overrides for `ConfirmationFooter`. */
export interface ConfirmationFooterColors {
  /** Top border color of the action row. Defaults to `--stroke-tertiary`. */
  border?: string;
}

/** Style overrides for `ConfirmationFooter`. */
export interface ConfirmationFooterStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ConfirmationFooterColors;
}

/** Props for `ConfirmationFooter`. */
export interface ConfirmationFooterProps {
  /** Label of the confirming action button. */
  confirmLabel: string;
  /** Label of the cancel button. */
  cancelLabel: string;
  /** Palette of the confirm button; `Danger` also gives it a leading trash icon. Default: `ConfirmationPopupVariant.Info`. */
  variant?: ConfirmationPopupVariant;
  /** Whether the confirmed action is in flight. Default: `false`. */
  isLoading?: boolean;
  /**
   * Whether confirming is not yet possible because the step's required input
   * is unsatisfied — e.g. no published folder chosen yet. Kept separate from
   * `isLoading`: a confirmation that cannot run yet and one already running are
   * different states, and only `isLoading` disables cancel. Default: `false`.
   */
  isConfirmDisabled?: boolean;
  /** Status text announced to assistive tech while the action is in flight. */
  loadingStatusLabel?: string;
  /** Style overrides. */
  styles?: ConfirmationFooterStyles;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the user cancels. */
  onCancel: () => void;
}

/** Action row pinned to the bottom of a confirmation step: a text Cancel and a variant-colored confirm button. */
export const ConfirmationFooter: FC<ConfirmationFooterProps> = ({
  confirmLabel,
  cancelLabel,
  variant = ConfirmationPopupVariant.Info,
  isLoading = false,
  isConfirmDisabled = false,
  loadingStatusLabel,
  styles: stylesProp,
  onConfirm,
  onCancel,
}) => {
  const isDanger = variant === ConfirmationPopupVariant.Danger;
  const cssVars = buildCssVars({
    '--cfm-footer-border': stylesProp?.colors?.border,
  });

  const iconBefore = (() => {
    if (isLoading) {
      return <Spinner size={DIAL_ICON_SIZE.SM} />;
    }
    if (isDanger) {
      return (
        <IconTrashX
          size={DIAL_ICON_SIZE.MD}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      );
    }
    return undefined;
  })();

  const ConfirmButton = isDanger ? DangerButton : NeutralButton;

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'flex items-center justify-end gap-2 px-6 py-4 rtl:flex-row-reverse rtl:justify-start',
        styles.footer,
      )}
    >
      <GhostButton
        label={cancelLabel}
        disabled={isLoading}
        onClick={onCancel}
      />
      <ConfirmButton
        label={confirmLabel}
        disabled={isLoading || isConfirmDisabled}
        iconBefore={iconBefore}
        onClick={onConfirm}
      />
      {isLoading && loadingStatusLabel != null && (
        <span role="status" aria-live="polite" className="sr-only">
          {loadingStatusLabel}
        </span>
      )}
    </div>
  );
};
