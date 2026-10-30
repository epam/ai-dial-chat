import type { AvatarColorClasses } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';

/** One extension service rendered as one row of the Extensions table. */
export interface ExtensionServiceItem {
  /** Stable identifier for the row. */
  id: string;
  /** Service display name shown beside the avatar and used for its initials. */
  displayName: string;
  /** Explicit avatar colour pair (an `AVATAR_PALETTE` entry from the host) overriding the name-derived colour; omitted keeps the deterministic pick. */
  avatarColor?: AvatarColorClasses;
  /** Localized service description shown in the Description cell. */
  description: string;
  /** Whether the disconnected-state warning badge renders on the avatar's corner. */
  isWarningVisible: boolean;
  /** Label of the red limited-access `Badge` that replaces the row's action while the host reports limited access; the row renders no badge when omitted. */
  limitedAccessLabel?: string;
  /** Bold title line of the limited-access badge's tooltip. */
  limitedAccessTooltipTitle?: string;
  /** Explanation shown below the limited-access badge and repeated in its tooltip; also referenced by the badge's aria-describedby. */
  limitedAccessTooltipDescription?: string;
  /** The row's trailing action (e.g. a Log in / Log out button), owned by the host; ignored while `limitedAccessLabel` is set. */
  action: ReactNode;
}

/** Localized strings shared by the Extensions table shell. */
export interface ExtensionsLabels {
  /** Accessible name of the table. */
  tableAriaLabel: string;
  /** Column header text for the Name column. */
  nameColumnLabel: string;
  /** Column header text for the Description column. */
  descriptionColumnLabel: string;
  /** Screen-reader-only column header text for the visually empty Actions column. */
  actionsColumnLabel: string;
}

/** Color overrides for `ExtensionsSection`, applied as CSS custom properties. */
export interface ExtensionsColors {
  /** Table container background. Fallback: `--bg-layer-raised`. */
  containerBackground?: string;
  /** Column header text color. Fallback: `--text-secondary`. */
  columnHeaderColor?: string;
  /** Row divider color. Fallback: `--stroke-tertiary`. */
  rowDividerColor?: string;
  /** Service name text color. Fallback: `--text-primary`. */
  nameColor?: string;
  /** Service and limited-access description text color. Fallback: `--text-secondary` for the service description, `--text-primary` for the limited-access explanation. */
  descriptionColor?: string;
  /** Warning badge color. Fallback: `--text-warning-icon`. */
  warningBadgeColor?: string;
}

/** Typography class overrides for `ExtensionsSection`. */
export interface ExtensionsTypography {
  /** CSS class for the column headers. Defaults to `'dial-caption-lead-semi-text'`. */
  columnHeaderClassName?: string;
  /** CSS class for the service name. Defaults to `'dial-small-semi-text'`. */
  nameClassName?: string;
  /** CSS class for the service description and limited-access explanation. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
  /** CSS class for the limited-access tooltip title. Defaults to `'dial-small-semi-text'`. */
  tooltipTitleClassName?: string;
  /** CSS class for the limited-access tooltip description. Defaults to `'dial-small-text'`. */
  tooltipDescriptionClassName?: string;
  /** CSS class for the initials in a service avatar without an icon. Defaults to `'dial-h2-text'`. */
  avatarInitialsClassName?: string;
}

/** Style overrides accepted by `ExtensionsSection`. */
export interface ExtensionsStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ExtensionsColors;
  /** Typography class overrides. */
  typography?: ExtensionsTypography;
}

/** Props for `ExtensionsSection`. */
export interface ExtensionsSectionProps {
  /** Services to render, in display order. Each renders as one table row. */
  rows: ExtensionServiceItem[];
  /** Localized strings shared by the table shell. */
  labels: ExtensionsLabels;
  /** Style overrides applied as CSS custom properties and typography class overrides. */
  styles?: ExtensionsStyles;
}
