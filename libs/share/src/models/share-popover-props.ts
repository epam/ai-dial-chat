import type { ShareLinkAccess } from '../types/share';

/** All user-visible strings in {@link SharePopoverProps}, with English defaults. */
export interface SharePopoverLabels {
  /** Popover heading and dialog `aria-label`. Defaults to `"Share"`. */
  title?: string;
  /** QR-tab button label. Defaults to `"QR"`. */
  qrButtonLabel?: string;
  /** Link-tab (back) button label and label above the URL input field. Defaults to `"Link"`. */
  linkLabel?: string;
  /** Primary row text. Defaults to `"Anyone with the link"`. */
  anyoneWithLinkTitle?: string;
  /** Secondary row text. Defaults to `"in your organization"`. */
  anyoneWithLinkSubtitle?: string;
  /** `aria-label` for the access-level control. Defaults to `"Link access level"`. */
  accessAriaLabel?: string;
  /** Access-dropdown option for view access. Defaults to `"Can view"`. */
  accessViewLabel?: string;
  /** Access-dropdown option for edit access. Defaults to `"Can edit"`. */
  accessEditLabel?: string;
  /** Visibility note shown when access is View. */
  visibilityNote?: string;
  /** Visibility note shown when access is Edit. */
  visibilityNoteEdit?: string;
  /** Copy button default label. Defaults to `"Copy"`. */
  copyButtonLabel?: string;
  /** Copy button label after copying. Defaults to `"Copied"`. */
  copiedButtonLabel?: string;
  /** `aria-label` for the share-link URL input. Defaults to `"Share link"`. */
  linkAriaLabel?: string;
  /** Pre-formatted expiry note (e.g. "This link is active for 3 days."). */
  expiryNote?: string;
  /** `aria-label` on the QR placeholder image. Defaults to `"QR code for the share link"`. */
  qrCodeAriaLabel?: string;
  /** `aria-label` for the loading skeleton. Defaults to `"Creating share link…"`. */
  loadingLabel?: string;
  /** Error message shown when share-link creation fails. */
  errorTitle?: string;
}

/** CSS custom-property overrides for `SharePopover` and its descendants (`AccessControl`, `LinkView`). */
export interface SharePopoverColors {
  /** Access-trigger button background color. */
  accessTriggerBackground?: string;
  /** Access-trigger button border color. */
  accessTriggerBorder?: string;
  /** Access-trigger button border color on hover. */
  accessTriggerBorderHover?: string;
  /** Access-trigger button border color on focus/open. */
  accessTriggerBorderFocus?: string;
  /** Access-trigger button label text color. */
  accessTriggerText?: string;
  /** Popover header title text color. */
  titleText?: string;
  /** "Anyone with the link" row icon badge background color. */
  linkIconBackground?: string;
  /** "Anyone with the link" row icon badge icon color. */
  linkIconText?: string;
  /** "Anyone with the link" row primary text color. */
  anyoneTitle?: string;
  /** "Anyone with the link" row secondary text color. */
  anyoneSubtitle?: string;
  /** Access-trigger chevron icon color. */
  accessChevron?: string;
  /** Access menu item background color on hover. */
  menuItemHover?: string;
  /** Access menu item focus-visible ring color. */
  menuItemFocusShadow?: string;
  /** Access menu item background color when checked. */
  menuItemCheckedBackground?: string;
  /** Access menu item label text color. */
  menuItemLabel?: string;
  /** Section heading text color (e.g. above the link input). */
  sectionLabel?: string;
  /** Error message text color. */
  errorText?: string;
  /** Visibility/expiry note text color. */
  noteText?: string;
  /** Divider line color below the header. */
  divider?: string;
}

/** Typography overrides for `SharePopover`. */
export interface SharePopoverTypography {
  /** CSS class applied to the error message. Defaults to `'dial-tiny-text'`. */
  errorClassName?: string;
  /** CSS class applied to the visibility and expiry notes. Defaults to `'dial-tiny-text'`. */
  noteClassName?: string;
}

/** Combined color and typography overrides for `SharePopover`. */
export interface SharePopoverStyles {
  /** Color overrides applied as CSS custom properties, cascaded to `AccessControl` and `LinkView`. */
  colors?: SharePopoverColors;
  /** Typography (font utility class) overrides for the error message and notes. */
  typography?: SharePopoverTypography;
}

/** Props for `SharePopover`. */
export interface SharePopoverProps {
  /** Resolved share URL; `undefined` while loading. */
  url: string | undefined;
  /** Whether the share link is still being fetched. */
  isLoading: boolean;
  /** Set when the share link could not be created. */
  error: Error | null;
  /** Current access levels granted to link holders. */
  access: ShareLinkAccess[];
  /** True for editable entity types (Agent, Application, Skill, Toolset); false for Model. */
  canEditAccess: boolean;
  /** Called when the user selects a different access level. */
  onAccessChange: (access: ShareLinkAccess[]) => void;
  /** Called when the popover should close. */
  onClose: () => void;
  /** Overrides for user-visible strings. All fields have English defaults. */
  labels?: SharePopoverLabels;
  /** CSS class applied to the popover container. */
  className?: string;
  /** Color and typography overrides applied as CSS custom properties / utility classes. */
  styles?: SharePopoverStyles;
}
