import type { Attachment } from '@epam/ai-dial-chat-shared';
import type { DeploymentItemDto } from '@epam/chat-api-client';
import type { InputColors, InputTypography } from './Input.js';

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
  /** Called when the user clicks the stop button during streaming. */
  onStop?: () => void;
  /** When `true`, shows a stop button instead of the send button and blocks Enter. */
  isStreaming?: boolean;
  /** Called whenever the attachment list changes. */
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  /** Color overrides applied as CSS custom properties. */
  colors?: ConversationInputColors;
  /** Typography overrides for the welcome heading and input. */
  typography?: ConversationInputTypography;
  /** Extra class name(s) merged onto the root wrapper element. */
  className?: string;
  /** List of deployment items to populate the model selector menu. When `undefined`, the selector is not rendered. */
  catalogItems?: DeploymentItemDto[];
  /** ID of the currently selected catalog item. When `null` or `undefined` and `catalogItems` is defined, the send button is disabled. */
  selectedCatalogItemId?: string | null;
  /** Called when the user selects a different catalog item from the dropdown. Receives the selected item's `id`. */
  onSelectedCatalogItemChange?: (id: string) => void;
  /** Accessible label for the model selector trigger button (e.g. "Select model"). */
  modelSelectorAriaLabel?: string;
  /** Text displayed (as a disabled menu item) while catalog items are loading. */
  modelSelectorLoadingLabel?: string;
  /** Text displayed (as a disabled menu item) when the catalog fetch failed. */
  modelSelectorErrorLabel?: string;
  /** Text displayed (as a disabled menu item) when the catalog returned no items. */
  modelSelectorEmptyLabel?: string;
}
