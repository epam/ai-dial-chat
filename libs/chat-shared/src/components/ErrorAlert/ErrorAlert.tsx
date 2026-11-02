import { DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconAlertTriangle } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { FullScreenAlert } from '../FullScreenAlert/FullScreenAlert';
import styles from './ErrorAlert.module.scss';

/** User-visible strings of `ErrorAlert`. */
export interface ErrorAlertLabels {
  /** Screen heading. Defaults to `'Something went wrong'`. */
  heading?: string;
  /** Explanation under the heading. Defaults to `'An unexpected error occurred. You can try again or reload the page.'`. */
  message?: string;
  /** Recovery button text. Defaults to `'Try again'`. */
  actionLabel?: string;
}

/** CSS custom-property overrides for `ErrorAlert`. */
export interface ErrorAlertColors {
  /** Warning icon color. Defaults to `--text-error`. */
  icon?: string;
}

/** Props for `ErrorAlert`. */
export interface ErrorAlertProps {
  /** Called when the recovery button is activated, e.g. to reset an error boundary or reload the page. */
  onAction: () => void;
  /** User-visible strings, each with an English default. */
  labels?: ErrorAlertLabels;
  /** Color overrides applied as CSS custom properties. */
  colors?: ErrorAlertColors;
}

/** Full-screen error fallback with a warning icon and one recovery action. */
export const ErrorAlert: FC<ErrorAlertProps> = memo(
  ({ onAction, labels, colors }) => (
    <div
      className="size-full"
      style={buildCssVars({ '--ea-icon': colors?.icon })}
    >
      <FullScreenAlert
        icon={
          <IconAlertTriangle
            aria-hidden="true"
            size={DIAL_ICON_SIZE.LG}
            stroke={DIAL_KIT_ICON_STROKE}
            className={styles.icon}
          />
        }
        heading={labels?.heading ?? 'Something went wrong'}
        message={
          labels?.message ??
          'An unexpected error occurred. You can try again or reload the page.'
        }
        actionLabel={labels?.actionLabel ?? 'Try again'}
        onAction={onAction}
      />
    </div>
  ),
);
