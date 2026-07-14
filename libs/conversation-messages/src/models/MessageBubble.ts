import type {
  CodeBlockTheme,
  DisplayAttachment,
  MessageRole,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';
import type { BubblePosition } from '../types/bubble-position';
import type { MessageActionsProps } from './MessageActions';

/** CSS custom-property overrides for message bubble components. */
export interface MessageBubbleColors {
  /** Background color of the user message bubble. */
  userBackground?: string;
  /** Text color applied to all message bubbles. */
  text?: string;
  /** Border color of the divider line above quick-reply starter buttons. Falls back to `--color-secondary` when omitted. */
  startersDivider?: string;
}

/** Typography overrides for message bubble components. */
export interface MessageBubbleTypography {
  /** Tailwind (or custom) class applied to message text — takes precedence over the individual font properties below. */
  fontClassName?: string;
  /** Font family of message text (CSS value, e.g. `"'Inter', sans-serif"`). Ignored when `fontClassName` is set. */
  fontFamily?: string;
  /** Font size of message text (CSS value, e.g. `'16px'`). Ignored when `fontClassName` is set. */
  fontSize?: string;
  /** Font weight of message text. Ignored when `fontClassName` is set. */
  fontWeight?: string | number;
  /** Line height of message text (CSS value, e.g. `'1.5'`). Ignored when `fontClassName` is set. */
  lineHeight?: string;
}

/** Combined style overrides (colors and typography) for message bubble components. */
export interface MessageBubbleStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageBubbleColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: MessageBubbleTypography;
}

/** Shared props for user and assistant message bubble components. */
interface BaseMessageBubbleProps {
  /** Plain-text (or Markdown) content of the message. */
  text: string;
  /** Extra class name(s) merged onto the outer row wrapper. */
  className?: string;
  /** Extra class name(s) merged onto the bubble element itself. */
  bubbleClassName?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: MessageBubbleStyles;
  /** Props forwarded to the `MessageActions` bar rendered below the bubble. */
  actions?: MessageActionsProps;
  /** When `true`, the actions bar is always visible instead of appearing only on group hover. */
  hasAlwaysVisibleActions?: boolean;
  /** When `true`, assistant markdown text reveals newly appended content smoothly. */
  isStreaming?: boolean;
  /** Display attachments associated with the message. Rendered above text for user messages and below text for assistant messages. */
  attachments?: DisplayAttachment[];
}

/** Props accepted by the `UserMessageBubble` component. */
export interface UserMessageBubbleProps extends BaseMessageBubbleProps {
  /** Position within a message group — controls which corner is rounded. Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
  /** Maximum number of text lines shown while a long user message is collapsed. Defaults to `10`. */
  collapsedLineCount?: number;
  /** Button label shown when a collapsed user message can be expanded. Defaults to `"Show more"`. */
  showMoreLabel?: string;
  /** Button label shown when an expanded user message can be collapsed. Defaults to `"Show less"`. */
  showLessLabel?: string;
  /** Accessible label for the expand button. Defaults to the `showMoreLabel` value. */
  showMoreAriaLabel?: string;
  /** Accessible label for the collapse button. Defaults to the `showLessLabel` value. */
  showLessAriaLabel?: string;
  /** Called when the user clicks an attachment tile/row. Passed through to `AttachmentGroup`. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Accessible label forwarded to each attachment tile/row when it is interactive. */
  attachmentClickLabel?: string;
  /** Called when the user retries a failed attachment upload. */
  onAttachmentRetry?: (id: string) => void;
  /** Accessible label for each attachment row's retry action. */
  attachmentRetryLabel?: string;
  /** Resolves a human-readable size label for an attachment, when derivable. Omitted from display when absent. */
  getAttachmentSizeLabel?: (
    attachment: DisplayAttachment,
  ) => string | undefined;
  /**
   * Surface color theme for non-previewable attachment tiles, matching the
   * markdown code block's own light/dark surface (never plain white).
   * Forwarded to `AttachmentGroup`. Defaults to `'dark'`.
   */
  attachmentTheme?: CodeBlockTheme;
}

/** Props accepted by the `AssistantMessageBubble` component. */
export interface AssistantMessageBubbleProps extends BaseMessageBubbleProps {
  /** Called when the user clicks an attachment tile/row in the assistant bubble's group. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Accessible label forwarded to each attachment tile/row when it is interactive. */
  attachmentClickLabel?: string;
  /** Called when the user retries a failed attachment upload. */
  onAttachmentRetry?: (id: string) => void;
  /** Accessible label for each attachment row's retry action. */
  attachmentRetryLabel?: string;
  /** Resolves a human-readable size label for an attachment, when derivable. Omitted from display when absent. */
  getAttachmentSizeLabel?: (
    attachment: DisplayAttachment,
  ) => string | undefined;
  /**
   * Surface color theme for non-previewable attachment tiles, matching the
   * markdown code block's own light/dark surface (never plain white).
   * Forwarded to `AttachmentGroup`. Defaults to `'dark'`.
   */
  attachmentTheme?: CodeBlockTheme;
  /**
   * react-markdown component overrides merged on top of the built-in map.
   * Pass a custom `p` (or other element) renderer here to inject React nodes
   * — such as citation markers — into specific markdown elements.
   */
  markdownComponents?: Components;
  /**
   * Quick-reply buttons derived from the assistant message's `form_schema`.
   * Rendered below the message text when the array is non-empty.
   */
  starters?: StarterOption[];
  /** Called with the selected `StarterOption` when a quick-reply button is clicked. */
  onSelectStarter?: (starter: StarterOption) => void;
  /** Accessible label for the quick-reply buttons list. Defaults to `"Quick reply buttons"`. */
  startersAriaLabel?: string;
  /** Content rendered between the message body and the actions bar (e.g. a stages panel). */
  afterContent?: ReactNode;
  /**
   * Resolved URL for the deployment icon shown in the message header.
   * When absent (e.g. legacy messages without a stored `deploymentId`), no icon is rendered.
   */
  deploymentIconUrl?: string;
  /** Human-readable deployment name shown as the icon's accessible label. */
  deploymentDisplayName?: string;
  /**
   * Label shown with a shimmer animation while `isStreaming` is true and the message text is still empty.
   * Pass a translated string from the consuming app. Defaults to `'Thinking'`.
   */
  thinkingLabel?: string;
  /** Accessible label for the copy button in code blocks. Forwarded to `MDMessageViewer`. */
  codeBlockCopyLabel?: string;
  /** Accessible label for the copy button after copying. Forwarded to `MDMessageViewer`. */
  codeBlockCopiedLabel?: string;
  /** Syntax highlight color theme for code blocks. Forwarded to `MDMessageViewer`. Defaults to `'dark'`. */
  codeBlockTheme?: CodeBlockTheme;
}

/** Props accepted by the `MessageBubble` role-switching wrapper. */
export interface MessageBubbleProps extends BaseMessageBubbleProps {
  /** Whether the message was authored by the user or the assistant. */
  role: MessageRole;
  /** Position within a message group — controls which corner is rounded (user messages only). Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
  /** Maximum number of text lines shown while a long user message is collapsed. Forwarded to `UserMessageBubble`; ignored for assistant messages. */
  collapsedLineCount?: number;
  /** Button label shown when a collapsed user message can be expanded. Forwarded to `UserMessageBubble`; ignored for assistant messages. */
  showMoreLabel?: string;
  /** Button label shown when an expanded user message can be collapsed. Forwarded to `UserMessageBubble`; ignored for assistant messages. */
  showLessLabel?: string;
  /** Accessible label for the expand button. Forwarded to `UserMessageBubble`; ignored for assistant messages. */
  showMoreAriaLabel?: string;
  /** Accessible label for the collapse button. Forwarded to `UserMessageBubble`; ignored for assistant messages. */
  showLessAriaLabel?: string;
  /**
   * Quick-reply buttons derived from the assistant message's `form_schema`.
   * Forwarded to `AssistantMessageBubble`; ignored for user messages.
   */
  starters?: StarterOption[];
  /** Called with the selected `StarterOption` when a quick-reply button is clicked. Forwarded to `AssistantMessageBubble`. */
  onSelectStarter?: (starter: StarterOption) => void;
  /** Accessible label for the quick-reply buttons list. Forwarded to `AssistantMessageBubble`; ignored for user messages. */
  startersAriaLabel?: string;
  /** Content rendered between the message body and the actions bar. Forwarded to `AssistantMessageBubble`; ignored for user messages. */
  afterContent?: ReactNode;
  /**
   * Resolved deployment icon URL. Forwarded to `AssistantMessageBubble` when role is `Assistant`;
   * used to render the `StatusMessageBubble` icon when role is `Status`.
   * Omitted for legacy messages that pre-date this feature.
   */
  deploymentIconUrl?: string;
  /** Human-readable deployment name. Forwarded to `AssistantMessageBubble`; used in status message text when role is `Status`. */
  deploymentDisplayName?: string;
  /**
   * Bold prefix text for the status message banner.
   * Only used when `role === MessageRole.Status`. Defaults to `"Model switched."`.
   */
  statusTitleText?: string;
  /**
   * Full description text for the status message banner, e.g. "The model has been switched from GPT to Imagen."
   * Required when `role === MessageRole.Status`.
   */
  statusBodyText?: string;
  /**
   * Label shown with a shimmer animation while `isStreaming` is true and the message text is still empty.
   * Forwarded to `AssistantMessageBubble`. Defaults to `'Thinking'`.
   */
  thinkingLabel?: string;
  /**
   * react-markdown component overrides forwarded to `AssistantMessageBubble`.
   * Ignored for user and status messages.
   */
  markdownComponents?: Components;
  /** Accessible label for the copy button in code blocks. Forwarded to `AssistantMessageBubble`. */
  codeBlockCopyLabel?: string;
  /** Accessible label for the copy button after copying. Forwarded to `AssistantMessageBubble`. */
  codeBlockCopiedLabel?: string;
  /** Syntax highlight color theme for code blocks. Forwarded to `AssistantMessageBubble`. Defaults to `'dark'`. */
  codeBlockTheme?: CodeBlockTheme;
  /** Called when the user clicks an attachment tile/row. Forwarded to both `UserMessageBubble` and `AssistantMessageBubble`. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Accessible label forwarded to each attachment tile/row when it is interactive. Forwarded to both `UserMessageBubble` and `AssistantMessageBubble`. */
  attachmentClickLabel?: string;
  /** Called when the user retries a failed attachment upload. Forwarded to both `UserMessageBubble` and `AssistantMessageBubble`. */
  onAttachmentRetry?: (id: string) => void;
  /** Accessible label for each attachment row's retry action. Forwarded to both `UserMessageBubble` and `AssistantMessageBubble`. */
  attachmentRetryLabel?: string;
  /** Resolves a human-readable size label for an attachment, when derivable. Forwarded to both `UserMessageBubble` and `AssistantMessageBubble`. */
  getAttachmentSizeLabel?: (
    attachment: DisplayAttachment,
  ) => string | undefined;
  /**
   * Surface color theme for non-previewable attachment tiles, matching the
   * markdown code block's own light/dark surface (never plain white).
   * Forwarded to both `UserMessageBubble` and `AssistantMessageBubble`.
   * Defaults to `'dark'`.
   */
  attachmentTheme?: CodeBlockTheme;
}
