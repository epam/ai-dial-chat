import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  PrimaryButton,
  StateScreen,
} from '@epam/ai-dial-ui-kit';
import { IconRefresh } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import styles from './NewVersionAlert.module.scss';

/** User-visible strings of `NewVersionAlert`. */
export interface NewVersionAlertLabels {
  /** Screen heading. Defaults to `'New version available'`. */
  heading?: string;
  /** Explanation under the heading. Defaults to `'Reload the page to get the latest version.'`. */
  message?: string;
  /** Reload button text. Defaults to `'Reload the page'`. */
  reloadLabel?: string;
}

/** CSS custom-property overrides for `NewVersionAlert`. */
export interface NewVersionAlertColors {
  /** Refresh icon color. Defaults to `--text-accent`. */
  icon?: string;
}

/** Props for `NewVersionAlert`. */
export interface NewVersionAlertProps {
  /** Called when the reload button is activated; the host reloads the page. */
  onReload: () => void;
  /** User-visible strings, each with an English default. */
  labels?: NewVersionAlertLabels;
  /** Color overrides applied as CSS custom properties. */
  colors?: NewVersionAlertColors;
}

// Page state, not a live update: the auto-focused action is what gets announced.
/** Full-screen prompt shown instead of the app once a newer build has been deployed. */
export const NewVersionAlert: FC<NewVersionAlertProps> = memo(
  ({ onReload, labels, colors }) => (
    <div
      className="size-full"
      style={buildCssVars({ '--nva-icon': colors?.icon })}
    >
      <StateScreen
        icon={
          <IconRefresh
            aria-hidden="true"
            size={DIAL_ICON_SIZE.LG}
            stroke={DIAL_KIT_ICON_STROKE}
            className={styles.icon}
          />
        }
        title={labels?.heading ?? 'New version available'}
        description={
          labels?.message ?? 'Reload the page to get the latest version.'
        }
        action={
          <PrimaryButton
            autoFocus
            label={labels?.reloadLabel ?? 'Reload the page'}
            onClick={onReload}
          />
        }
      />
    </div>
  ),
);
