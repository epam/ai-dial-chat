import { NoDataContent } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import styles from './PanelEmptyState.module.scss';

/** CSS custom-property overrides for the `PanelEmptyState` component. */
export interface PanelEmptyStateColors {
  /** Label text color. */
  label?: string;
}

/** Props for `PanelEmptyState`. */
export interface PanelEmptyStateProps {
  /** Primary message of the empty state. */
  label: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: PanelEmptyStateColors;
  /** CSS class applied to the label text. Defaults to `'dial-tiny-text'`. */
  labelClassName?: string;
  /** CSS class applied to the empty-state container. */
  containerClassName?: string;
}

/** Centered empty-state block for use inside a sidebar panel body. */
export const PanelEmptyState: FC<PanelEmptyStateProps> = memo(
  ({
    label,
    colors,
    labelClassName = 'dial-tiny-text',
    containerClassName,
  }) => {
    const cssVars = buildCssVars({
      '--pes-label-color': colors?.label,
    });

    return (
      <div style={cssVars}>
        <NoDataContent
          title={label}
          titleClassName={mergeClasses(styles.label, labelClassName)}
          className={containerClassName}
        />
      </div>
    );
  },
);
