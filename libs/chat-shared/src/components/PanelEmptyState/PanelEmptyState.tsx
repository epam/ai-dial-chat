import { DialNoDataContent } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import styles from './PanelEmptyState.module.scss';

/** CSS custom-property overrides for the `PanelEmptyState` component. */
export interface PanelEmptyStateColors {
  /** Icon color. */
  icon?: string;
  /** Label text color. */
  label?: string;
}

/** Props for `PanelEmptyState`. */
export interface PanelEmptyStateProps {
  /** Icon element rendered above the label. */
  icon: ReactNode;
  /** Primary message shown beneath the icon. */
  label: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: PanelEmptyStateColors;
}

/** Centered empty-state block for use inside a sidebar panel body. */
export const PanelEmptyState: FC<PanelEmptyStateProps> = memo(
  ({ icon, label, colors }) => {
    const cssVars = buildCssVars({
      '--pes-icon-color': colors?.icon,
      '--pes-label-color': colors?.label,
    });

    return (
      <div style={cssVars}>
        <DialNoDataContent
          title={label}
          icon={<span className={styles.icon}>{icon}</span>}
          titleClassName={styles.label}
        />
      </div>
    );
  },
);
