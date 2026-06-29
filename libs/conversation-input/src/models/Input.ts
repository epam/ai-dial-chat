import type {
  Attachment,
  AttachmentErrorReason,
  DeploymentFeatures,
  DeploymentItem,
  DisplayAttachment,
  ResponseFormat,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';

/**
 * Controls which key combination submits the message in the `Input` component.
 * - `Enter` (default): Enter submits; Shift+Enter inserts a newline.
 * - `MetaEnter`: ⌘+Enter (macOS) / Ctrl+Enter (Windows/Linux) submits; bare Enter inserts a newline.
 */
export enum SendOnEnter {
  /** Enter submits; Shift+Enter inserts a newline. */
  Enter = 'enter',
  /** ⌘+Enter (macOS) / Ctrl+Enter (Windows/Linux) submits; bare Enter inserts a newline. */
  MetaEnter = 'meta-enter',
}

/** CSS custom-property overrides for the `Input` component. */
export interface InputColors {
  /** Input area background color. */
  background?: string;
  /** Typed text color. */
  text?: string;
  /** Border color in the default (unfocused) state. */
  border?: string;
  /** Border color on hover (unfocused). */
  borderHover?: string;
  /** Border color when the input is focused. */
  borderFocus?: string;
  /** Placeholder text color. */
  placeholder?: string;
  /** Box-shadow in the default state (e.g. a subtle inset shadow). */
  shadow?: string;
  /** Box-shadow when the input is focused. Falls back to `shadow` when unset. */
  shadowFocus?: string;
  /** Background color of the send button. */
  sendBackground?: string;
  /** Icon/text color of the send button. */
  sendText?: string;
  /** Icon color of the stop button. Defaults to `--text-secondary` (`#9fa6bd`). */
  stopColor?: string;
}

/** Typography overrides for the `Input` component. */
export interface InputTypography {
  /** Typography utility class applied to the textarea (e.g. `'dial-body-paragraph-text'`). */
  fontClassName?: string;
  /** Font family applied to the textarea. */
  fontFamily?: string;
  /** Font size applied to the textarea (CSS value, e.g. `'14px'`). */
  fontSize?: string;
  /** Font weight applied to the textarea. */
  fontWeight?: string | number;
  /** Line height applied to the textarea (CSS value, e.g. `'1.5'`). */
  lineHeight?: string;
}

/** Status labels displayed inside the model selector dropdown and mobile bottom-sheet. */
export interface ModelSelectorLabels {
  /** Accessible label for the selector trigger button (e.g. `"Select model"`). */
  ariaLabel?: string;
  /** Shown as a disabled item while deployments are loading. */
  loading?: string;
  /** Shown as a disabled item when the deployments fetch failed. */
  error?: string;
  /** Shown as a disabled item when the deployments list is empty. */
  empty?: string;
  /** Placeholder for the search input. Defaults to `'Search'`. */
  searchPlaceholder?: string;
  /** Accessible label for the close button in the mobile bottom-sheet. Defaults to `'Close'`. */
  closeLabel?: string;
}

/** Props accepted by the `Input` component. */
export interface InputProps {
  /**
   * Message value. Sets the initial textarea content on mount and syncs the
   * textarea whenever the value changes to a non-empty string.
   */
  message?: string;
  /** Called on every keystroke with the current textarea value. */
  onChange?: (message: string) => void;
  /** Called when the user submits a message (Enter or send button). Receives the current local attachments as the second argument. Returning a rejected promise transitions attachments to Error state. */
  onSend?: (message: string, attachments: Attachment[]) => Promise<void> | void;
  /** Called immediately after an attachment is added. Returns the uploaded attachment URL. */
  onUploadAttachment?: (attachment: Attachment) => Promise<string>;
  /** Called when the user clicks the stop button during streaming. */
  onStop?: () => void;
  /** When `true`, shows a stop button instead of the send button. */
  isStreaming?: boolean;
  /** Called whenever the attachment list changes. */
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  /** Placeholder text shown when the textarea is empty. */
  placeholder?: string;
  /** `aria-label` applied to the textarea for screen readers. */
  ariaLabel?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: InputColors;
  /** Typography overrides applied as CSS custom properties. */
  typography?: InputTypography;
  /** Label for the attach-file menu item. */
  attachLabel?: string;
  /** Accessible label for the add-menu trigger button. */
  addMenuLabel?: string;
  /** Accessible label for each attachment card's remove button. */
  removeLabel?: string;
  /** Accessible label for each attachment card's retry button (error state only). */
  retryLabel?: string;
  /** Accessible label for the send button. */
  sendLabel?: string;
  /** Tooltip shown on hover over the send button. */
  sendTitle?: string;
  /** Accessible label for the stop button. */
  stopLabel?: string;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
  /** Files dropped onto the parent that should be processed as attachments. Reset to `[]` after processing. */
  pendingDropFiles?: File[];
  /** Called after `pendingDropFiles` have been consumed so the parent can reset its state. */
  onDropFilesConsumed?: () => void;
  /** Already-uploaded attachments supplied by the host and awaiting insertion into the local tray. */
  pendingAttachments?: Attachment[];
  /** Called after `pendingAttachments` have been inserted into the local tray. */
  onPendingAttachmentsConsumed?: () => void;
  /** Character count above which a pasted plain-text string is converted to an attachment rather than inserted inline. Defaults to `4000`. Pass `Infinity` to disable. */
  pasteTextThreshold?: number;
  /**
   * List of deployment items to populate the model selector menu. When `undefined`, the selector is not rendered.
   * `iconUrl` on each item must already be a fully resolved URL usable in `<img src>` — the host app
   * resolves DIAL file IDs, theme-relative names, etc. before passing the list.
   */
  deployments?: DeploymentItem[];
  /** ID of the currently selected deployment. When `null` or `undefined` and `deployments` is defined, the send button is disabled. */
  selectedDeploymentId?: string | null;
  /** Called when the user selects a different deployment from the dropdown. Receives the selected item's `id`. */
  onDeploymentChange?: (id: string) => void;
  /** Labels shown inside the model selector dropdown for the trigger and various loading states. */
  modelSelectorLabels?: ModelSelectorLabels;
  /** Heading text shown in the mobile bottom-sheet add-menu. Defaults to `'Menu'`. */
  menuTitle?: string;
  /** Accessible label for the bottom-sheet close button. Defaults to `'Close'`. */
  menuCloseLabel?: string;
  /** Attachments pre-populated in the tray on mount (e.g. when editing an existing message). */
  initialAttachments?: Attachment[];
  /**
   * When `true`, the textarea always renders on its own row above the action bar
   * (attach button on the left, footer actions on the right), instead of the
   * compact single-row layout used when no attachments are present. Used by the
   * edit-message UI, which always wants the stacked layout.
   */
  isStacked?: boolean;
  /**
   * When `true`, the attach (+) button and its associated hidden file input are
   * not rendered. Use this when the caller manages file picking outside the
   * component (e.g. `EditMessageInput` renders the `+` button outside the
   * bordered box and feeds files back via `pendingDropFiles`).
   */
  hideAddButton?: boolean;
  /**
   * When `true`, the "Attach file" item is removed from the attach menu.
   * Other menu items (e.g. DIAL file system) remain visible. When no items
   * remain in the menu the entire attach (+) button is hidden automatically.
   */
  hideAttachFile?: boolean;
  /**
   * When `true`, the entire action bar row (attach button, send/stop button,
   * model selector, and any `renderFooterActions` content) is not rendered.
   * The bordered box contains only the attachment tray and textarea. Use in
   * `EditMessageInput` where the action row lives outside the bordered box.
   */
  hideActionBar?: boolean;
  /**
   * When provided, replaces the default send/stop/model-selector area with custom content.
   * Receives `canSend` (textarea has non-empty trimmed content) and `onSend` (triggers the
   * same internal send flow as the default send button).
   */
  renderFooterActions?: (helpers: {
    canSend: boolean;
    onSend: () => void;
  }) => ReactNode;
  /** When `true`, blocks all text input, send, attach, and drop interactions. Starter/action buttons remain usable. Defaults to `false`. */
  isInputDisabled?: boolean;
  /**
   * When `true`, the mic button is rendered and voice recording is enabled.
   * Derived by the host app from the selected deployment's `inputAttachmentTypes`.
   */
  isTranscriptionSupported?: boolean;
  /**
   * Called when the user confirms a voice recording.
   * Receives the recorded `File` and its detected MIME type.
   * Resolves with the DIAL storage URL for the uploaded audio.
   */
  onUploadAudio?: (file: File, contentType: string) => Promise<string>;
  /**
   * Called after successful audio upload with the DIAL storage URL.
   * Resolves with the transcript text.
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
  /** Attachments managed externally (e.g. pre-existing kept attachments in edit mode) prepended to the tray alongside locally-added ones. */
  prefixAttachments?: DisplayAttachment[];
  /** Called when the user removes an attachment from `prefixAttachments`. */
  onRemovePrefixAttachment?: (id: string) => void;
  /**
   * When provided, a "Chat settings" item is added to the `+` menu.
   * Clicking it opens a modal with fields gated by `features`.
   * Modal state is managed internally by the component.
   */
  chatSettings?: ChatSettingsConfig;
  /** When `true`, focuses the textarea on mount. Defaults to `false`. */
  autoFocus?: boolean;
  /**
   * Ordered list of previously sent message strings (oldest first, most-recent
   * last). When provided, Up/Down arrow keys navigate through the history.
   * Omit or pass an empty array to disable keyboard history navigation.
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
   * Called when the user clicks or keyboard-activates an attachment card.
   * Receives the full `Attachment` object (including the local `File`).
   * When absent the card is not rendered as interactive.
   */
  onAttachmentClick?: (attachment: Attachment) => void;
  /**
   * When provided, the desktop model-selector chip opens this panel instead of
   * the flat deployment list. Receives `onClose` so the panel can close the
   * popover after a selection or an explicit dismiss.
   */
  modelPickerOverlay?: (onClose: () => void) => ReactNode;
}

/** Values emitted by the chat-settings modal when the user clicks Save. */
export interface ChatSettingsValues {
  /** Updated response format, present when the response-format field was shown. */
  responseFormat?: ResponseFormat;
  /** Updated system prompt, present when the system-prompt field was shown. */
  systemPrompt?: string;
  /** Updated temperature, present when the temperature field was shown. */
  temperature?: number;
}

/** Configuration for the built-in chat-settings menu entry and modal. */
export interface ChatSettingsConfig {
  /** Feature flags controlling which fields appear in the modal. */
  features: DeploymentFeatures;
  /** Current response format pre-selected in the modal. Defaults to `ResponseFormat.Markdown`. */
  responseFormat?: ResponseFormat;
  /** Current system prompt pre-populated in the modal textarea. */
  systemPrompt: string;
  /** Current temperature pre-populated in the modal numeric input. */
  temperature: number;
  /** Called with updated values when the user clicks Save. */
  onSave: (values: ChatSettingsValues) => void;
  /** Label for the "Chat settings" dropdown item. Defaults to `'Chat settings'`. */
  menuItemLabel?: string;
  /** Modal title. Defaults to `'Chat settings'`. */
  title?: string;
  /** Label for the response format field. Defaults to `'Response format'`. */
  responseFormatLabel?: string;
  /** Helper text shown below the response format field. Defaults to `'Applies to new and existing messages'`. */
  responseFormatHint?: string;
  /** Label for the Markdown radio option. Defaults to `'Markdown'`. */
  responseFormatMarkdownLabel?: string;
  /** Label for the Plain text radio option. Defaults to `'Plain text'`. */
  responseFormatPlainTextLabel?: string;
  /** Label for the system prompt field. Defaults to `'System prompt'`. */
  systemPromptLabel?: string;
  /** Tooltip shown on the system prompt input. Defaults to `'Enter a prompt'`. */
  systemPromptTooltip?: string;
  /** Label for the temperature field. Defaults to `'Temperature'`. */
  temperatureLabel?: string;
  /** Labels rendered below the temperature slider: [start, middle, end]. Defaults to `['Precise', 'Neutral', 'Creative']`. */
  temperatureLabels?: [string, string, string];
  /** Helper text shown below the temperature field. */
  temperatureHint?: string;
  /** Label for the save button. Defaults to `'Apply changes'`. */
  saveLabel?: string;
  /** Accessible label for the back arrow in the mobile bottom-sheet stack. Defaults to `'Back'`. */
  backLabel?: string;
}
