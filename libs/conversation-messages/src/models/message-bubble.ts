import type {
  CodeBlockTheme,
  DisplayAttachment,
  MessageRole,
  StarterOption,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';
import type { BubblePosition } from '../types/bubble-position';
import type { MessageActionsProps } from './message-actions';

/** CSS custom-property overrides for message bubble components. */
export interface MessageBubbleColors {
  /** Background color of the user message bubble. */
  userBackground?: string;
  /** Border color of the user message bubble. */
  userBorder?: string;
  /** Gradient start color for a collapsed user message fade-out. Defaults to transparent. */
  fadeStart?: string;
  /** Text color applied to all message bubbles. */
  text?: string;
  /** Divider color above quick-reply buttons. Falls back to `--color-secondary`. */
  startersDivider?: string;
}

/** Typography overrides for message bubble components. */
export interface MessageBubbleTypography {
  /** Tailwind (or custom) class applied to message text. */
  fontClassName?: string;
}

/** Color and typography overrides for message bubble components. */
export interface MessageBubbleStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageBubbleColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: MessageBubbleTypography;
  /** Extra class(es) on the row wrapper. */
  className?: string;
  /** Extra class(es) on the bubble element. */
  bubbleClassName?: string;
}

/** Localised labels for message bubble components. */
export interface MessageBubbleLabels {
  /** Expand button label. Defaults to `"Show more"`. */
  showMoreLabel?: string;
  /** Collapse button label. Defaults to `"Show less"`. */
  showLessLabel?: string;
  /** aria-label for the expand button. Defaults to `showMoreLabel`. */
  showMoreAriaLabel?: string;
  /** aria-label for the collapse button. Defaults to `showLessLabel`. */
  showLessAriaLabel?: string;
  /** aria-label for the user message group. Defaults to `"User message"`. */
  userMessageAriaLabel?: string;
  /** aria-label for the assistant message group. Defaults to `"Assistant message"`. */
  assistantMessageAriaLabel?: string;
  /** aria-label for interactive attachment tiles. */
  attachmentClickLabel?: string;
  /** aria-label for the attachment retry button. */
  attachmentRetryLabel?: string;
  /** aria-label for the attachment open-in-new-tab button. */
  attachmentOpenInNewTabLabel?: string;
  /** Bold prefix for the status banner. Used when `role === MessageRole.Status`. Defaults to `"Model switched."`. */
  statusTitleText?: string;
  /** Body text for the status banner. Required when `role === MessageRole.Status`. */
  statusBodyText?: string;
}

/** Localised labels for the `AssistantMessageBubble` component. */
export interface AssistantMessageBubbleLabels extends MessageBubbleLabels {
  /** aria-label for the quick-reply list. Defaults to `"Quick reply buttons"`. */
  startersAriaLabel?: string;
  /** Shimmer placeholder shown while streaming and message text is empty. Defaults to `'Thinking'`. */
  thinkingLabel?: string;
  /** aria-label for the code block copy button. */
  codeBlockCopyLabel?: string;
  /** aria-label for the code block copy button after copying. */
  codeBlockCopiedLabel?: string;
  /** Fallback aria-label for the deployment icon. Defaults to `'AI'`. */
  deploymentIconFallbackLabel?: string;
}

/** Shared props for user and assistant message bubble components. */
interface BaseMessageBubbleProps {
  /** Plain-text (or Markdown) content of the message. */
  text: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: MessageBubbleStyles;
  /** Props for the `MessageActions` bar below the bubble. */
  actions?: MessageActionsProps;
  /** Shows the actions bar permanently instead of on group hover only. */
  hasAlwaysVisibleActions?: boolean;
  /** When `true`, assistant markdown text reveals newly appended content smoothly. */
  isStreaming?: boolean;
  /** Attachments shown above (user) or below (assistant) the message text. */
  attachments?: DisplayAttachment[];
  /** Localised labels for the toggle button and attachment rows. */
  labels?: MessageBubbleLabels;
  /** Fires when an attachment is clicked. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /** Fires with all downloadable attachments when "download all" is triggered. */
  onDownloadAll?: (attachments: DisplayAttachment[]) => void;
  /** Fires when a failed attachment upload is retried. */
  onAttachmentRetry?: (id: string) => void;
}

/** Props for `UserMessageBubble`. */
export interface UserMessageBubbleProps extends BaseMessageBubbleProps {
  /** Corner rounding position within a message group. Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
  /** Maximum number of text lines shown while a long user message is collapsed. Defaults to `10`. */
  collapsedLineCount?: number;
}

/** Props for `AssistantMessageBubble`. */
export interface AssistantMessageBubbleProps extends BaseMessageBubbleProps {
  /** react-markdown component overrides. Use to inject custom renderers (e.g. citation markers) into markdown elements. */
  markdownComponents?: Components;
  /** Quick-reply buttons rendered below the message text when non-empty. */
  starters?: StarterOption[];
  /** Fires with the clicked `StarterOption`. */
  onSelectStarter?: (starter: StarterOption) => void;
  /** Content rendered between the message body and the actions bar (e.g. a stages panel). */
  afterContent?: ReactNode;
  /** Deployment icon URL. When absent, no icon is rendered. */
  deploymentIconUrl?: string;
  /** Deployment name used as the icon's accessible label. */
  deploymentDisplayName?: string;
  /** Syntax highlight theme for code blocks. Defaults to `'dark'`. */
  codeBlockTheme?: CodeBlockTheme;
  /** Localised labels for quick replies, the thinking indicator, and code block copy actions. */
  labels?: AssistantMessageBubbleLabels;
}

/** Props for `MessageBubble` — `AssistantMessageBubbleProps` plus user-only fields and `role`. */
export type MessageBubbleProps = AssistantMessageBubbleProps &
  Pick<UserMessageBubbleProps, 'position' | 'collapsedLineCount'> & {
    /** Message author/type: user, assistant, or status banner. */
    role: MessageRole;
  };
