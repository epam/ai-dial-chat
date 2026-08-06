/** Color overrides for `AppIdentity`, applied as CSS custom properties. */
export interface AppIdentityColors {
  /** Entity name text color. Fallback: `--text-primary`. */
  nameColor?: string;
  /** Last-used line text color. Fallback: `--text-tertiary`. */
  lastUsedColor?: string;
  /** Version text color. Fallback: `--text-secondary`. */
  versionColor?: string;
}

/** Typography class overrides for `AppIdentity`. */
export interface AppIdentityTypography {
  /** CSS class for the type label. Default: `'dial-caption-semi-text'`. */
  typeClassName?: string;
  /** Typography CSS class for the entity name. Default: `'dial-body-semi-text'`. */
  nameClassName?: string;
  /** Typography CSS class for the version string. Default: `'dial-tiny-text'`. */
  versionClassName?: string;
  /** Typography CSS class for the last-used line text and icon. Default: `'dial-tiny-text'`. */
  lastUsedClassName?: string;
}

/** Grouped style overrides for `AppIdentity`. */
export interface AppIdentityStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: AppIdentityColors;
  /** Typography class overrides. */
  typography?: AppIdentityTypography;
}
