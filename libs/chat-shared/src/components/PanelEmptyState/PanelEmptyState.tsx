import { NoDataContent } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import styles from './PanelEmptyState.module.scss';

/** CSS custom-property overrides for the `PanelEmptyState` component. */
export interface PanelEmptyStateColors {
  /** Label text color. */
  label?: string;
  /** Description text color. */
  description?: string;
}

/** Props for `PanelEmptyState`. */
export interface PanelEmptyStateProps {
  /** Primary message of the empty state. */
  label: string;
  /** Secondary line under the label, e.g. what to do next. */
  description?: string;
  /** Optional way forward, such as a button, rendered under the text. */
  action?: ReactNode;
  /** Color overrides applied as CSS custom properties. */
  colors?: PanelEmptyStateColors;
  /** CSS class applied to the label text, on top of the kit's title typography. */
  labelClassName?: string;
  /** CSS class applied to the description text, on top of the kit's description typography. */
  descriptionClassName?: string;
  /** CSS class applied to the empty-state container. */
  containerClassName?: string;
  /** Decorative illustration above the label. Defaults to the kit's `NoDataContent` illustration. */
  icon?: ReactNode;
  /** Announces the empty state to assistive tech as it appears, e.g. after a search. */
  live?: boolean;
}

/** Centered empty-state block for use inside a sidebar panel body. */
export const PanelEmptyState: FC<PanelEmptyStateProps> = memo(
  ({
    label,
    description,
    action,
    colors,
    labelClassName,
    descriptionClassName,
    containerClassName,
    icon,
    live,
  }) => {
    const cssVars = buildCssVars({
      '--pes-label-color': colors?.label,
      '--pes-description-color': colors?.description,
    });

    return (
      <div style={cssVars}>
        <NoDataContent
          title={label}
          description={description}
          action={action}
          icon={icon}
          live={live}
          titleClassName={mergeClasses(styles.label, labelClassName)}
          descriptionClassName={mergeClasses(
            styles.description,
            descriptionClassName,
          )}
          className={containerClassName}
        />
      </div>
    );
  },
);
