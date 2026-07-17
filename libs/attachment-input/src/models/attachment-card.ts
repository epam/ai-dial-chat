import type { DisplayAttachment } from '@epam/ai-dial-chat-shared';
import type { Icon } from '@tabler/icons-react';

/** Localised labels for the non-extension attachment type names derived by `getAttachmentCardState`. */
export interface AttachmentTypeLabels {
  /** Label shown for a prompt-type attachment. Defaults to `'Prompt'`. */
  promptLabel?: string;
  /** Label shown for a pasted-text attachment. Defaults to `'Pasted'`. */
  pastedLabel?: string;
  /** Label shown for an image attachment. Defaults to `'Image'`. */
  imageLabel?: string;
}

/** Derived display state an AttachmentCard/AttachmentFileRow needs to render a given attachment. */
export interface AttachmentCardState {
  /** Whether the attachment is currently uploading. */
  isLoading: boolean;
  /** Whether the attachment's upload failed. */
  isError: boolean;
  /** Whether the attachment should render as a previewable image tile. */
  isImage: boolean;
  /** Whether the attachment should render as an audio player tile. */
  isAudio: boolean;
  /** Whether action buttons (remove/retry) should always be shown, not just on hover/focus. */
  areActionsVisible: boolean;
  /** Icon component representing the attachment's type. */
  BottomIcon: Icon;
  /** Human-readable type/status label rendered next to `BottomIcon`. */
  typeLabel: string;
  /** CSS class(es) applied to the card for its current color state (error/selected/type). */
  cardColorClass: string;
  /** CSS class(es) applied to the remove/retry action buttons for the current state. */
  removeBtnClass: string;
}

/** CSS custom-property overrides for the `AttachmentCard` component. */
export interface AttachmentCardColors {
  /** Card border color in the default state. */
  border?: string;
  /** Card background color in the default state. */
  background?: string;
  /** File name text color. */
  nameText?: string;
  /** Meta (type / label) text color. */
  metaText?: string;
  /** Card border color in the error state. */
  borderError?: string;
  /** Card background color in the selected state. */
  backgroundSelected?: string;
  /** Card border color in the selected state. */
  borderSelected?: string;
  /** Card background color on hover (prompt/pasted cards). */
  backgroundHover?: string;
  /** Loading overlay background color. */
  loadingOverlayBackground?: string;
  /** Action button (remove/retry/download) icon color. */
  actionColor?: string;
  /** Action button background color on hover. */
  actionBackgroundHover?: string;
  /** Focus outline color. */
  focusOutline?: string;
  /** Remove/retry button background color. */
  removeBackground?: string;
  /** Remove/retry button icon color. */
  removeColor?: string;
  /** Hover download icon background color. */
  hoverIconBackground?: string;
  /** Hover download icon color. */
  hoverIconColor?: string;
}

/** Typography overrides for the `AttachmentCard` component. */
export interface AttachmentCardTypography {
  /** Utility class applied to the file name text. Defaults to `'dial-tiny-text'`. */
  fontClassName?: string;
  /** Utility class applied to the bottom meta label (file type / status). Defaults to `'dial-tiny-text'`. */
  metaClassName?: string;
  /** Utility class applied to the placeholder icon shown while the image is loading. Defaults to `'text-secondary'`. */
  placeholderIconClassName?: string;
}

/** Combined style overrides (colors, typography, and shape) for the `AttachmentCard` component. */
export interface AttachmentCardStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: AttachmentCardColors;
  /** Typography overrides for text elements inside the card. */
  typography?: AttachmentCardTypography;
  /** Tailwind border-radius utility class applied to the card and its inner layers (e.g. `'rounded'`, `'rounded-lg'`). Defaults to `'rounded-xl'`. */
  roundedClassName?: string;
}

/** Localised accessible labels for the `AttachmentCard` component. */
export interface AttachmentCardLabels {
  /** Accessible label for the remove button. Defaults to `'Remove attachment'`. */
  removeLabel?: string;
  /** Accessible label for the retry button (error state only). Defaults to `'Retry upload'`. */
  retryLabel?: string;
  /** Accessible label applied to the card root when it is interactive via `onClick`. Defaults to `'Open attachment'`. */
  clickLabel?: string;
  /** Accessible label applied to the card root when it is interactive via `onExpand` (pasted-text cards). Defaults to `'Expand pasted text'`. */
  expandLabel?: string;
  /** Accessible label for the loading spinner shown while the attachment is uploading. Defaults to `'Loading attachment'`. */
  loadingLabel?: string;
  /** Status message announced to assistive tech when the upload fails. Defaults to `'Upload failed'`. */
  uploadFailedStatusLabel?: string;
}

/** Props accepted by the `AttachmentCard` component. */
export interface AttachmentCardProps {
  /** The attachment data to display. */
  attachment: DisplayAttachment;
  /** Current search query — when set, matches in the file name are highlighted. Defaults to `''`. */
  searchQuery?: string;
  /** Called when the user activates the remove button. */
  onRemove?: (id: string) => void;
  /** Called when the user activates the retry button (error state only). */
  onRetry?: (id: string) => void;
  /** Called when the user clicks or activates a pasted-text card to expand its content back into the input. */
  onExpand?: (id: string) => void;
  /** Renders the card in selected state (accent border + tinted background). */
  isSelected?: boolean;
  /** Forces action buttons to be always visible regardless of hover/focus state. */
  shouldAlwaysShowActions?: boolean;
  /** Called when the user clicks or keyboard-activates the card. Receives the attachment `id`. */
  onClick?: (id: string) => void;
  /** Localised accessible labels for the remove/retry actions and the interactive card root. */
  labels?: AttachmentCardLabels;
  /** Localised labels for the non-extension attachment type names (prompt/pasted/image). */
  typeLabels?: AttachmentTypeLabels;
  /** Color, typography, and shape overrides for the card. */
  styles?: AttachmentCardStyles;
  /**
   * Shows a small decorative download-icon overlay on hover/focus, on top of
   * the existing whole-card click-to-download interaction. Opt-in so the
   * composer (which uses remove/retry actions, not download) is unaffected.
   * Defaults to `false`.
   */
  showHoverDownloadIcon?: boolean;
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}
