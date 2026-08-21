import type { CSSProperties } from 'react';
import type { NavigationMenuGroup } from './navigation-menu';
import type { NavigationUserProfile } from './user-profile';

/** CSS custom-property overrides for `UserMenu`. */
export interface UserMenuColors {
  /** Avatar initials-badge background. */
  avatarBackground?: string;
  /** Avatar initials text color. */
  avatarText?: string;
  /** Menu label text color. */
  text?: string;
  /** Check-mark color marking the active option. */
  activeIcon?: string;
  /** Trigger background on hover. */
  triggerHoverBackground?: string;
}

/** Typography overrides for `UserMenu`. */
export interface UserMenuTypography {
  /** CSS class applied to menu labels. Defaults to `'dial-small-text'`. */
  fontClassName?: string;
  /** `font-family` applied to the menu trigger and overlay content. */
  fontFamily?: string;
}

/** Combined style overrides for `UserMenu`. */
export interface UserMenuStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: UserMenuColors;
  /** Typography overrides applied to menu labels. */
  typography?: UserMenuTypography;
  /** Extra class name(s) merged onto the trigger wrapper. */
  className?: string;
  /** CSS custom properties applied to the trigger wrapper. */
  cssVars?: CSSProperties;
}

/** Translated labels required by `UserMenu`. */
export interface UserMenuLabels {
  /** Accessible name for the avatar trigger, e.g. `"Signed in as a@b.c"`. */
  trigger: string;
  /** Alternative text for the avatar image. */
  avatarAlt: string;
  /** Label of the log-out entry. */
  logOut: string;
  /** Label of the settings entry; required when `onSettings` is provided. */
  settings?: string;
}

/** Props accepted by `UserMenu`. */
export interface UserMenuProps {
  /** Signed-in user details used for the identity row and avatar. */
  profile: NavigationUserProfile;
  /** Translated labels for the trigger, avatar, and log-out entry. */
  labels: UserMenuLabels;
  /** Single-select settings groups rendered as submenus; empty groups are skipped. */
  groups?: NavigationMenuGroup[];
  /** Called when the user picks "Log out"; the host owns the confirmation flow. */
  onLogout: () => void;
  /** When provided, renders a Settings entry that invokes this callback. */
  onSettings?: () => void;
  /** Hides the avatar tooltip — set on touch layouts where hover never fires. */
  isTooltipHidden?: boolean;
  /** Style overrides for colors, typography, and class names. */
  styles?: UserMenuStyles;
}
