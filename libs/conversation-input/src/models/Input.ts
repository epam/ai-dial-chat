import type {
  Attachment,
  AttachmentErrorReason,
  DeploymentFeatures,
  DeploymentItem,
  DisplayAttachment,
  ResponseFormat,
  ToolMenuItem,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';

/** Controls which key combination submits the message in the `Input` component. */
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

/** Labels for the selected-tools chip row that appears in the input when tools are active. */
export interface ToolsChipLabels {
  /** Formats the consolidated count label for the mobile chip. Receives the number of selected tools. Defaults to English pluralization. */
  countLabel?: (count: number) => string;
  /** Returns the accessible label for the close button on a desktop chip. Receives the tool label. Defaults to `"Remove {toolLabel}"`. */
  removeLabel?: (toolLabel: string) => string;
}

/** Props accepted by the `Input` component. */
export interface InputProps {
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
  /** Called on every keystroke with the current textarea value. */
  onChange?: (message: string) => void;
  /** Called when the user submits a message. */
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
  /**
   * Value applied verbatim as the `accept` attribute on the native device
   * file picker (`<input type="file">`), hinting the OS dialog to grey out or
   * hide unsupported file types. The host resolves it from the selected
   * model's supported attachment types; the lib treats it as an opaque string.
   * When absent, no `accept` attribute is set and every file type is selectable.
   */
  fileAccept?: string;
  /** Tooltip title for the add-menu trigger button. */
  addMenuTitle?: string;
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
   * (attach button at the start, footer actions at the end), instead of the
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
   * When `true`, the model selector renders in a disabled, non-interactive
   * state (dimmed, does not open) while still showing the current model.
   * Independent of `isInputDisabled`, which disables the rest of the
   * composer — typing and sending remain usable.
   */
  isModelSelectorDisabled?: boolean;
  /**
   * When `true`, disables the send action without removing or dimming the
   * send button itself. Independent of `isInputDisabled`/`isStreaming`.
   * Defaults to `false`.
   */
  isSendDisabled?: boolean;
  /**
   * When `true`, the mic button is rendered and voice recording is enabled.
   * Derived by the host app from the selected deployment's `inputAttachmentTypes`.
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
  /** Resolved tool toggle items rendered in a "Tools" submenu. When empty or absent, no Tools item is shown. */
  toolsMenuItems?: ToolMenuItem[];
  /** Called when a tool row is toggled. Receives the tool id. */
  onToolToggle?: (toolId: string) => void;
  /** Label for the "Tools" menu item and mobile sheet title. Defaults to `'Tools'`. */
  toolsMenuTitle?: string;
  /** Accessible label for the back arrow in the mobile tools bottom sheet. Defaults to `'Back'`. */
  toolsBackLabel?: string;
  /** Labels for the selected-tools chip row shown in the input when tools are active. */
  toolsChipLabels?: ToolsChipLabels;
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
   * Maximum number of attachments allowed in the tray. Undefined, `0`, or
   * non-finite values mean there is no count limit.
   */
  maximumAttachmentsAmount?: number;
  /**
   * Called when adding a file/drop/pending attachment batch would exceed
   * `maximumAttachmentsAmount`.
   */
  onAttachmentsLimitExceeded?: (count: number, limit: number) => void;
  /**
   * Called when the user clicks or keyboard-activates an attachment card.
   * Receives a `DisplayAttachment` — covers both newly-added attachments
   * (which carry a local `File`) and pre-existing ones (which only have a URL).
   * When absent the card is not rendered as interactive.
   */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
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
  /** Tooltip shown on the save button when it is disabled (e.g. no response format selected). */
  saveDisabledTooltip?: string;
  /** Accessible label for the back arrow in the mobile bottom-sheet stack. Defaults to `'Back'`. */
  backLabel?: string;
}
