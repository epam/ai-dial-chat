import type {
  Attachment,
  AttachmentErrorReason,
  DeploymentItem,
  DisplayAttachment,
  ToolMenuItem,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
import type {
  ChatSettingsConfig,
  InputColors,
  InputTypography,
  ModelSelectorLabels,
  SendOnEnter,
  ToolsChipLabels,
} from './Input';

/** CSS custom-property overrides for the `ConversationInput` component. */
export interface ConversationInputColors {
  /** Root container background color. */
  background?: string;
  /** Welcome heading text color. */
  welcomeText?: string;
  /** Color overrides forwarded to the inner `Input` component. */
  input?: InputColors;
}

/** Typography overrides for the `ConversationInput` component. */
export interface ConversationInputTypography {
  /** Tailwind (or custom) class applied to the welcome heading. */
  welcomeClassName?: string;
  /** Typography overrides forwarded to the inner `Input` component. */
  input?: InputTypography;
}

/** Combined color and typography overrides for the `ConversationInput` component. */
export interface ConversationInputStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ConversationInputColors;
  /** Typography overrides for the welcome heading and input. */
  typography?: ConversationInputTypography;
}

/** Props accepted by the `EditMessageInput` component. */
export interface EditMessageInputProps {
  /** Initial message text pre-populated in the textarea. */
  message?: string;
  /** Pre-existing attachments from the original message, shown in the attachment tray. */
  initialAttachments?: DisplayAttachment[];
  /** Called when the user clicks the Cancel button. */
  onCancel: () => void;
  /**
   * Called when the user clicks Save & Submit.
   * @param message - The edited message text.
   * @param keptAttachments - Pre-existing attachments the user did not remove.
   * @param newAttachments - New attachments added during editing.
   */
  onSave: (
    message: string,
    keptAttachments: DisplayAttachment[],
    newAttachments: Attachment[],
  ) => void;
  /** Called immediately after a new attachment is added. Returns the uploaded attachment URL. */
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
  /** Label for the Cancel button. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Label for the Save & Submit button. Defaults to `'Save & Submit'`. */
  saveLabel?: string;
  /** `aria-label` applied to the textarea. */
  ariaLabel?: string;
  /** Accessible label for each attachment card's remove button. */
  removeLabel?: string;
  /** Accessible label for each attachment card's retry button (error state only). */
  retryLabel?: string;
  /** Accessible label for the add-menu trigger button. */
  addMenuTitle?: string;
  /** Label for the attach-file menu item. */
  attachLabel?: string;
  /** Heading text shown in the mobile bottom-sheet add-menu. Defaults to `'Menu'`. */
  menuTitle?: string;
  /** Accessible label for the bottom-sheet close button. Defaults to `'Close'`. */
  menuCloseLabel?: string;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
  /** Files supplied by a page-level drag-and-drop handler to be added as attachments. */
  pendingDropFiles?: File[];
  /** Called after the files have been consumed, signalling the parent to clear its state. */
  onDropFilesConsumed?: () => void;
  /**
   * Called synchronously for each attachment after it is added, before upload begins.
   * Return an `AttachmentErrorReason` to reject the attachment (it enters error state
   * and `onUploadAttachment` is NOT called). Return `undefined` to allow normal upload.
   */
  validateAttachment?: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  /**
   * Maximum number of kept plus newly added attachments. Undefined, `0`, or
   * non-finite values mean there is no count limit.
   */
  maximumAttachmentsAmount?: number;
  /**
   * Called when adding a file/drop batch would exceed
   * `maximumAttachmentsAmount`.
   */
  onAttachmentsLimitExceeded?: (count: number, limit: number) => void;
  /**
   * When `true`, the "Attach file" button is hidden.
   */
  hideAttachFile?: boolean;
  /**
   * Value applied verbatim as the `accept` attribute on the native device
   * file picker (`<input type="file">`), hinting the OS dialog to grey out or
   * hide unsupported file types. Resolved by the host from the selected
   * model's supported attachment types. When absent, every file type is
   * selectable.
   */
  fileAccept?: string;
  /** Called when user selects "DIAL file system" from the attach menu. When absent, the menu item is not rendered. */
  onDialFileSystemClick?: () => void;
  /** Label for the "DIAL file system" menu item. Defaults to `'DIAL file system'`. */
  dialFileSystemLabel?: string;
  /** Already-uploaded attachments supplied by the host and awaiting insertion into the local tray. */
  pendingAttachments?: Attachment[];
  /** Called after `pendingAttachments` have been inserted into the local tray. */
  onPendingAttachmentsConsumed?: () => void;
  /**
   * Called when the user clicks or keyboard-activates an attachment card in the tray.
   * Covers both newly-added and pre-existing (kept) attachments.
   * When absent the cards are not rendered as interactive.
   */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
}

/** Props accepted by the `ConversationInput` component. */
export interface ConversationInputProps {
  /** Placeholder text shown inside the textarea when empty. */
  placeholder?: string;
  /**
   * Message value. Sets the initial textarea content on mount and syncs the
   * textarea whenever the value changes.
   */
  message?: string;
  /**
   * Optional token that forces the textarea to resync from `message`, even
   * when `message` itself is the same string as before.
   */
  messageRevision?: number;
  /** Optional welcome heading rendered above the input. */
  welcomeText?: string;
  /** Called when the user submits a message (Enter or send button). Receives the current local attachments as the second argument. */
  onSend?: (message: string, attachments: Attachment[]) => void;
  /** Called immediately after an attachment is added. Returns the uploaded attachment URL. */
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
  /** Called when the user clicks the stop button during streaming. */
  onStop?: () => void;
  /** When `true`, shows a stop button instead of the send button and blocks Enter. */
  isStreaming?: boolean;
  /** Called whenever the attachment list changes. */
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: ConversationInputStyles;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
  /** Files supplied by a page-level drag-and-drop handler to be added as attachments. */
  pendingDropFiles?: File[];
  /** Called after the inner `Input` has consumed `pendingDropFiles`, signalling the parent to clear its state. */
  onDropFilesConsumed?: () => void;
  /** Already-uploaded attachments supplied by the host and awaiting insertion into the local tray. */
  pendingAttachments?: Attachment[];
  /** Called after `pendingAttachments` have been inserted into the local tray. */
  onPendingAttachmentsConsumed?: () => void;
  /** Character count above which a pasted plain-text string is converted to an attachment rather than inserted inline. Defaults to `4000`. Pass `Infinity` to disable. */
  pasteTextThreshold?: number;
  /**
   * List of deployment items to populate the model selector menu. When `undefined`, the selector is not rendered.
   * `iconUrl` on each item must already be a fully resolved URL usable in `<img src>`.
   */
  deployments?: DeploymentItem[];
  /** ID of the currently selected deployment. When `null` or `undefined` and `deployments` is defined, the send button is disabled. */
  selectedDeploymentId?: string | null;
  /** Called when the user selects a different deployment from the dropdown. Receives the selected item's `id`. */
  onDeploymentChange?: (id: string) => void;
  /** Labels shown inside the model selector dropdown for the trigger and various loading states. */
  modelSelectorLabels?: ModelSelectorLabels;
  /** Accessible label for the send button. */
  sendLabel?: string;
  /** Tooltip shown on hover over the send button. */
  sendTitle?: string;
  /** Accessible label for the stop button. */
  stopLabel?: string;
  /** When `true`, blocks all text input, send, attach, and drop interactions. Starter/action buttons remain usable. Defaults to `false`. */
  isInputDisabled?: boolean;
  /**
   * When `true`, the model selector renders in a disabled, non-interactive
   * state (dimmed, does not open) while still showing the current model.
   * Independent of `isInputDisabled`, which disables the rest of the
   * composer — typing and sending remain usable.
   */
  isModelSelectorDisabled?: boolean;
  /**
   * When `true`, the mic button is rendered and voice recording is enabled.
   * The host app derives this from the selected deployment's `inputAttachmentTypes`.
   * When `false` or absent, the mic button is hidden and the voice bar is never shown.
   */
  isAudioMessageSupported?: boolean;
  /** Accessible label for the mic button. Defaults to `'Record voice message'`. */
  micLabel?: string;
  /** Accessible label for the stop-recording button inside the voice bar. Defaults to `'Stop recording'`. */
  stopRecordingLabel?: string;
  /** Accessible label for the discard / X button inside the voice bar. Defaults to `'Discard recording'`. */
  discardRecordingLabel?: string;
  /** `aria-label` for the elapsed-time region inside the voice bar. Defaults to `'Recording time'`. */
  timerAriaLabel?: string;
  /**
   * Controls which key combination submits the message.
   * - `SendOnEnter.Enter` (default): Enter submits; Shift+Enter inserts a newline.
   * - `SendOnEnter.MetaEnter`: ⌘+Enter (macOS) / Ctrl+Enter (Windows/Linux) submits; bare Enter inserts a newline.
   */
  sendOnEnter?: SendOnEnter;
  /**
   * When provided, a "Chat settings" item is added to the `+` menu.
   * Clicking it opens a modal with fields gated by `features`.
   */
  chatSettings?: ChatSettingsConfig;
  /** When `true`, focuses the textarea on mount. Defaults to `false`. */
  autoFocus?: boolean;
  /**
   * Ordered list of previously sent message strings for the current
   * conversation (oldest first, most-recent last). When provided, pressing
   * Up in the textarea recalls the previous entry; pressing Down returns
   * toward the current draft. Omit or pass an empty array to disable
   * keyboard history navigation.
   */
  messageHistory?: readonly string[];
  /** Called when user selects "DIAL file system" from the attach menu. When absent, the menu item is not rendered. */
  onDialFileSystemClick?: () => void;
  /** Label for the "DIAL file system" menu item. Defaults to `'DIAL file system'`. */
  dialFileSystemLabel?: string;
  /** Accessible label for the `+` trigger button. Defaults to `'Add'`. */
  addMenuTitle?: string;
  /**
   * Value applied verbatim as the `accept` attribute on the native device
   * file picker (`<input type="file">`), hinting the OS dialog to grey out or
   * hide unsupported file types. Resolved by the host from the selected
   * model's supported attachment types. When absent, every file type is
   * selectable. Forwarded to the inner `Input`.
   */
  fileAccept?: string;
  /**
   * Called synchronously for each attachment after it is added, before upload begins.
   * Return an `AttachmentErrorReason` to reject the attachment (it enters error state
   * and `onUploadAttachment` is NOT called). Return `undefined` to allow normal upload.
   */
  validateAttachment?: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  /**
   * Maximum number of attachments allowed in the input tray. Undefined, `0`,
   * or non-finite values mean there is no count limit.
   */
  maximumAttachmentsAmount?: number;
  /**
   * Called when adding a file/drop/pending attachment batch would exceed
   * `maximumAttachmentsAmount`.
   */
  onAttachmentsLimitExceeded?: (count: number, limit: number) => void;
  /**
   * When `true`, the "Attach file" item is removed from the attach menu.
   * Other menu items (e.g. DIAL file system) remain visible. When no items
   * remain in the menu the entire attach (+) button is hidden automatically.
   */
  hideAttachFile?: boolean;
  /**
   * Called when the user clicks or keyboard-activates an attachment card.
   * Receives a `DisplayAttachment` (covers both new and pre-existing attachments).
   * When absent the card is not rendered as interactive.
   */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /**
   * When provided, the desktop model-selector chip opens this panel instead of
   * the flat deployment list. Receives `onClose` so the panel can close the
   * popover after a selection or an explicit dismiss.
   */
  // TODO: review usage
  modelPickerOverlay?: (onClose: () => void) => ReactNode;
  /** Resolved tool toggle items rendered in a "Tools" submenu. When empty or absent, no Tools item is shown. */
  toolsMenuItems?: ToolMenuItem[];
  /** Called when a tool row is toggled. Receives the tool id. */
  onToolToggle?: (toolId: string) => void;
  /** Label for the "Tools" menu item and mobile sheet title. Defaults to `'Tools'`. */
  toolsMenuTitle?: string;
  /** Labels for the selected-tools chip row shown in the input when tools are active. */
  toolsChipLabels?: ToolsChipLabels;
}
