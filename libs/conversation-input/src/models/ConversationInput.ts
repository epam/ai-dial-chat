import type {
  Attachment,
  AttachmentErrorReason,
  DeploymentItem,
  DisplayAttachment,
} from '@epam/ai-dial-chat-shared';
import type {
  ChatSettingsConfig,
  InputColors,
  InputTypography,
  ModelSelectorLabels,
  SendOnEnter,
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
  /** Tailwind (or custom) class applied to the welcome heading — takes precedence over the individual font properties below. */
  welcomeClassName?: string;
  /** Font family of the welcome heading (CSS value, e.g. `"'Inter', sans-serif"`). Ignored when `welcomeClassName` is set. */
  welcomeFontFamily?: string;
  /** Font size of the welcome heading (CSS value, e.g. `'24px'`). Ignored when `welcomeClassName` is set. */
  welcomeFontSize?: string;
  /** Font weight of the welcome heading. Ignored when `welcomeClassName` is set. */
  welcomeFontWeight?: string | number;
  /** Line height of the welcome heading. Ignored when `welcomeClassName` is set. */
  welcomeLineHeight?: string | number;
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
  addMenuLabel?: string;
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
   * When `true`, the "Attach file" button is hidden.
   */
  hideAttachFile?: boolean;
}

/** Props accepted by the `ConversationInput` component. */
export interface ConversationInputProps {
  /** Placeholder text shown inside the textarea when empty. */
  placeholder?: string;
  /**
   * Message value. Sets the initial textarea content on mount and syncs the
   * textarea whenever the value changes to a non-empty string.
   */
  message?: string;
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
  /** Accessible label for the stop button. */
  stopLabel?: string;
  /** When `true`, blocks all text input, send, attach, and drop interactions. Starter/action buttons remain usable. Defaults to `false`. */
  isInputDisabled?: boolean;
  /**
   * When `true`, the mic button is rendered and voice recording is enabled.
   * The host app derives this from the selected deployment's `inputAttachmentTypes`.
   * When `false` or absent, the mic button is hidden and the voice bar is never shown.
   */
  isTranscriptionSupported?: boolean;
  /**
   * Called when the user confirms a voice recording.
   * Receives the recorded `File` and its detected MIME type.
   * Should resolve with the DIAL storage URL for the uploaded audio.
   */
  onUploadAudio?: (file: File, contentType: string) => Promise<string>;
  /**
   * Called after successful audio upload with the returned DIAL storage URL.
   * Should resolve with the transcript text.
   */
  onTranscribeAudio?: (audioUrl: string) => Promise<string>;
  /** Accessible label for the mic button. Defaults to `'Record voice message'`. */
  micLabel?: string;
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
  /**
   * Called synchronously for each attachment after it is added, before upload begins.
   * Return an `AttachmentErrorReason` to reject the attachment (it enters error state
   * and `onUploadAttachment` is NOT called). Return `undefined` to allow normal upload.
   */
  validateAttachment?: (
    attachment: Attachment,
  ) => AttachmentErrorReason | undefined;
  /**
   * When `true`, the "Attach file" item is removed from the attach menu.
   * Other menu items (e.g. DIAL file system) remain visible. When no items
   * remain in the menu the entire attach (+) button is hidden automatically.
   */
  hideAttachFile?: boolean;
  /**
   * Called when the user clicks or keyboard-activates an attachment card.
   * Receives the full `Attachment` object (including the local `File`).
   * When absent the card is not rendered as interactive.
   */
  onAttachmentClick?: (attachment: Attachment) => void;
}
