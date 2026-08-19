import type { CSSProperties, ReactNode } from 'react';
import type { NavigationPanelItem } from './navigation-item';
import type { NavigationMenuGroup } from './navigation-menu';
import type { NavigationUserProfile } from './user-profile';

/** CSS custom-property overrides for the mobile navigation sheet. */
export interface NavigationSheetColors {
  /** Row label text color. */
  text?: string;
  /** Row background on hover. */
  itemHoverBackground?: string;
  /** Row background while pressed. */
  itemActiveBackground?: string;
  /** Row leading-icon color. */
  icon?: string;
  /** Divider color between row groups. */
  divider?: string;
  /** Avatar initials-badge background. */
  avatarBackground?: string;
  /** Avatar initials text color. */
  avatarText?: string;
  /** Check-mark color marking the active option. */
  activeIcon?: string;
}

/** Typography overrides for the mobile navigation sheet. */
export interface NavigationSheetTypography {
  /** CSS class applied to row labels. Defaults to `'dial-small-text'`. */
  fontClassName?: string;
  /** `font-family` applied to the sheet content. */
  fontFamily?: string;
}

/** Combined style overrides for the mobile navigation sheet. */
export interface NavigationSheetStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: NavigationSheetColors;
  /** Typography overrides applied to row labels. */
  typography?: NavigationSheetTypography;
  /** Extra class name(s) merged onto the sheet container. */
  className?: string;
  /** CSS custom properties applied to the sheet container. */
  cssVars?: CSSProperties;
}

/** Translated labels required by `NavigationSheet`. */
export interface NavigationSheetLabels {
  /** Root-page header title, e.g. `"Menu"`. */
  title: string;
  /** Accessible name for the close (×) button. */
  close: string;
  /** Accessible name for the back button shown on pushed pages. */
  back: string;
  /** Label of the row that opens the profile page, also its page title. */
  profile: string;
  /** Label of the log-out row. */
  logOut: string;
}

/** Props accepted by `NavigationSheet`. */
export interface NavigationSheetProps {
  /** Controls sheet visibility. */
  isOpen: boolean;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** Destinations rendered as rows on the root page, in display order. */
  items: NavigationPanelItem[];
  /** Called with the picked destination; the host performs the navigation. */
  onSelectItem: (item: NavigationPanelItem) => void;
  /** Translated labels for the header, profile row, and log-out row. */
  labels: NavigationSheetLabels;
  /** Signed-in user details shown on the profile page; omit to hide the profile row. */
  profile?: NavigationUserProfile;
  /** Single-select settings groups listed on the profile page; empty groups are skipped. */
  groups?: NavigationMenuGroup[];
  /** Called when the user taps "Log out"; the host owns the confirmation flow. */
  onLogout: () => void;
  /** Rendered at the end of the root page — typically a footer message. */
  footer?: ReactNode;
  /** Style overrides for colors, typography, and class names. */
  styles?: NavigationSheetStyles;
}
