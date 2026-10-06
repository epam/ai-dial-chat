import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { FC, ReactNode } from 'react';
import type { EntityHeaderItem } from '../../models/entity';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import { ConfirmationIdentityCard } from '../ConfirmationIdentityCard/ConfirmationIdentityCard';
import styles from './ConfirmationView.module.scss';

/** Color overrides for `ConfirmationView`. */
export interface ConfirmationViewColors {
  /** Body-copy text color. Defaults to `--text-primary`. */
  messageText?: string;
  /** Consequence-bullet text color. Defaults to `--text-secondary`. */
  consequenceText?: string;
  /** Identity-card surface in the `Info` variant. Defaults to `--bg-info`. */
  cardBackground?: string;
  /** Identity-card surface in the `Danger` variant. Defaults to `--bg-control-error-alpha-active`. */
  cardDangerBackground?: string;
  /** Identity-card border in the `Danger` variant. Defaults to `--stroke-error-alpha`. */
  cardDangerBorder?: string;
}

/** Style overrides for `ConfirmationView`. */
export interface ConfirmationViewStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ConfirmationViewColors;
}

/** Props for `ConfirmationView`. */
export interface ConfirmationViewProps {
  /** Entity the confirmation is about, rendered as an identity card above the copy. Ignored when `identity` is set; with neither, no card is rendered. */
  item?: EntityHeaderItem;
  /**
   * Identity card rendered in place of the default one, for a resource that is
   * not an `EntityHeaderItem` — a scheduled task, say, which has no catalog
   * entity type. Compose it from `ConfirmationIdentityCard` so the surface
   * still matches `variant`.
   */
  identity?: ReactNode;
  /** Body copy explaining what confirming does. */
  message: ReactNode;
  /** Consequences listed as bullets under the message. An empty or omitted list renders nothing. */
  consequences?: string[];
  /** Palette of the identity card. Default: `ConfirmationPopupVariant.Info`. */
  variant?: ConfirmationPopupVariant;
  /** Typography class applied to the message and the bullet list. Defaults to `'dial-small-text'`. */
  messageClassName?: string;
  /** Style overrides. */
  styles?: ConfirmationViewStyles;
  /**
   * Optional interactive slot rendered after the consequence bullets, for a
   * confirmation that needs an input before it can be confirmed — choosing
   * which published folder to unpublish from, say. This component stays
   * presentational: whoever passes the slot owns its state, and disabling the
   * confirm button until the input is satisfied is the caller's job. A step
   * that needs no input passes nothing.
   */
  children?: ReactNode;
}

/** Body of an in-place confirmation step: the resource's identity card, the confirmation copy, and an optional consequence list. */
export const ConfirmationView: FC<ConfirmationViewProps> = ({
  item,
  identity,
  message,
  consequences,
  variant = ConfirmationPopupVariant.Info,
  messageClassName = 'dial-small-text',
  styles: stylesProp,
  children,
}) => {
  const colors = stylesProp?.colors;
  const cssVars = buildCssVars({
    '--cfm-message-text': colors?.messageText,
    '--cfm-consequence-text': colors?.consequenceText,
  });

  return (
    <div style={cssVars} className="flex flex-col gap-4 px-6 py-4">
      {identity ??
        (item != null && (
          <ConfirmationIdentityCard
            item={item}
            variant={variant}
            styles={{
              colors: {
                background: colors?.cardBackground,
                dangerBackground: colors?.cardDangerBackground,
                dangerBorder: colors?.cardDangerBorder,
              },
            }}
          />
        ))}

      <p
        className={mergeClasses(
          messageClassName,
          'break-words',
          styles.message,
        )}
      >
        {message}
      </p>

      {consequences != null && consequences.length > 0 && (
        <ul
          className={mergeClasses(
            'flex list-disc flex-col gap-2 ps-5',
            messageClassName,
            styles.consequences,
          )}
        >
          {consequences.map((consequence) => (
            <li key={consequence}>{consequence}</li>
          ))}
        </ul>
      )}

      {children}
    </div>
  );
};
