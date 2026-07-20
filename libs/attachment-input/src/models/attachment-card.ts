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

/** Derived display state an AttachmentCard needs to render a given attachment. */
export interface AttachmentCardState {
  /** Whether the attachment is currently uploading. */
  isLoading: boolean;
  /** Whether the attachment's upload failed. */
  isError: boolean;
  /** Whether the attachment should render as a previewable image tile. */
  isImage: boolean;
  /** Whether the attachment should render as a link tile. */
  isLink: boolean;
  /** Whether the attachment should render as an audio player tile. */
  isAudio: boolean;
  /** Icon component representing the attachment's type. */
  BottomIcon: Icon | null;
  /** Human-readable type/status label rendered next to `BottomIcon`. */
  typeLabel: string | null;
}

/** CSS custom-property overrides for the `AttachmentCard` component. */
export interface AttachmentCardColors {
  /** Tile background color in the default state. */
  background?: string;
  /** Tile border color in the default state. */
  border?: string;
  /** Tile border color on hover. */
  borderHover?: string;
  /** Tile focus outline color. */
  focusOutline?: string;
  /** Tile background color in the error state. */
  backgroundError?: string;
  /** Tile border color in the error state. */
  borderError?: string;
  /** File name/type text color in the error state. */
  errorText?: string;
  /** File name text color. */
  nameText?: string;
  /** Type/meta text color. */
  typeText?: string;
  /** Hover download icon background color. */
  hoverIconBackground?: string;
  /** Hover download icon color. */
  hoverIconColor?: string;
  /** Upload progress track background color. */
  trackBackground?: string;
  /** Upload progress indeterminate fill color. */
  fillBackground?: string;
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
  /** Extra class name(s) merged onto the root element. */
  className?: string;
}

/** Localised accessible labels for the `AttachmentCard` component. */
export interface AttachmentCardLabels extends AttachmentTypeLabels {
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
  /** Accessible label for the download button. Defaults to `'Download attachment'`. */
  downloadLabel?: string;
  /** Accessible label for the open-in-new-tab button. Defaults to `'Open in new tab'`. */
  openInNewTabLabel?: string;
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
  /** Called when the user clicks or keyboard-activates the card. Receives the attachment `id`. */
  onClick?: (id: string) => void;
  /** Localised accessible labels for the remove/retry actions, the interactive card root, and the non-extension attachment type names (prompt/pasted/image). */
  labels?: AttachmentCardLabels;
  /** Color, typography, and shape overrides for the card. */
  styles?: AttachmentCardStyles;
  /** Called when the user activates the download button. Receives the attachment `id`. */
  onDownload?: (id: string) => void;
}
