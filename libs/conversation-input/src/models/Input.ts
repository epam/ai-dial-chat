import type { Attachment } from '@epam/ai-dial-chat-shared';
import type { DeploymentItemDto } from '@epam/chat-api-client';

/** CSS custom-property overrides for the `Input` component. */
export interface InputColors {
  /** Input area background color. */
  background?: string;
  /** Typed text color. */
  text?: string;
  /** Border color in the default (unfocused) state. */
  border?: string;
  /** Border color when the input is focused. */
  borderFocus?: string;
  /** Placeholder text color. */
  placeholder?: string;
  /** Background color of the send button. */
  sendBackground?: string;
  /** Icon/text color of the send button. */
  sendText?: string;
}

/** Typography overrides for the `Input` component. */
export interface InputTypography {
  /** Font family applied to the textarea. */
  fontFamily?: string;
  /** Font size applied to the textarea (CSS value, e.g. `'14px'`). */
  fontSize?: string;
  /** Font weight applied to the textarea. */
  fontWeight?: string | number;
  /** Line height applied to the textarea (CSS value, e.g. `'1.5'`). */
  lineHeight?: string;
}

/** Status labels displayed inside the model selector dropdown. */
export interface ModelSelectorLabels {
  /** Accessible label for the selector trigger button (e.g. `"Select model"`). */
  ariaLabel?: string;
  /** Shown as a disabled item while deployments are loading. */
  loading?: string;
  /** Shown as a disabled item when the deployments fetch failed. */
  error?: string;
  /** Shown as a disabled item when the deployments list is empty. */
  empty?: string;
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
  /** Called when the user submits a message (Enter or send button). Receives the current local attachments as the second argument. */
  onSend?: (message: string, attachments: Attachment[]) => void;
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
  /** Accessible label for the stop button. */
  stopLabel?: string;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
  /** Files dropped onto the parent that should be processed as attachments. Reset to `[]` after processing. */
  pendingDropFiles?: File[];
  /** Called after `pendingDropFiles` have been consumed so the parent can reset its state. */
  onDropFilesConsumed?: () => void;
  /** Character count above which a pasted plain-text string is converted to an attachment rather than inserted inline. Defaults to `4000`. Pass `Infinity` to disable. */
  pasteTextThreshold?: number;
  /** List of deployment items to populate the model selector menu. When `undefined`, the selector is not rendered. */
  deployments?: DeploymentItemDto[];
  /** ID of the currently selected deployment. When `null` or `undefined` and `deployments` is defined, the send button is disabled. */
  selectedDeploymentId?: string | null;
  /** Called when the user selects a different deployment from the dropdown. Receives the selected item's `id`. */
  onDeploymentChange?: (id: string) => void;
  /** Labels shown inside the model selector dropdown for the trigger and various loading states. */
  modelSelectorLabels?: ModelSelectorLabels;
}
