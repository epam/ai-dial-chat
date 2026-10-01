import type { FC, ReactNode } from 'react';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import styles from './ConfirmationIdentityRow.module.scss';

/** Color overrides for `ConfirmationIdentityRow`. */
export interface ConfirmationIdentityRowColors {
  /** Type label above the name. Defaults to `--text-secondary`. */
  typeLabelText?: string;
}

/** Style overrides for `ConfirmationIdentityRow`. */
export interface ConfirmationIdentityRowStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ConfirmationIdentityRowColors;
  /** Typography class applied to the type label. Defaults to `'dial-caption-lead-semi-text'`. */
  typeLabelClassName?: string;
  /** Typography class applied to the name. Defaults to `'dial-small-semi-text'`. */
  nameClassName?: string;
}

/** Props for `ConfirmationIdentityRow`. */
export interface ConfirmationIdentityRowProps {
  /** Icon shown ahead of the type and name. Supplied by the host, which owns the glyph set. */
  icon?: ReactNode;
  /** Resource type shown above the name. Pass it in sentence case — the default class uppercases it. */
  typeLabel?: string;
  /** Resource name, truncated rather than wrapped. */
  name: string;
  /** Style overrides. */
  styles?: ConfirmationIdentityRowStyles;
}

/**
 * Identity of a resource that has no `EntityHeaderItem` — a conversation or a
 * scheduled task, say — laid out as icon, type, and name for
 * `ConfirmationIdentityCard`'s `children`.
 */
export const ConfirmationIdentityRow: FC<ConfirmationIdentityRowProps> = ({
  icon,
  typeLabel,
  name,
  styles: stylesProp,
}) => {
  const {
    colors,
    typeLabelClassName = 'dial-caption-lead-semi-text',
    nameClassName = 'dial-small-semi-text',
  } = stylesProp ?? {};
  const cssVars = buildCssVars({
    '--cir-type-label-text': colors?.typeLabelText,
  });

  return (
    <div style={cssVars} className="flex min-w-0 items-center gap-2">
      {icon}
      <div className="flex min-w-0 flex-col">
        {typeLabel != null && (
          <span className={mergeClasses(typeLabelClassName, styles.typeLabel)}>
            {typeLabel}
          </span>
        )}
        <span className={mergeClasses(nameClassName, 'truncate')}>{name}</span>
      </div>
    </div>
  );
};
