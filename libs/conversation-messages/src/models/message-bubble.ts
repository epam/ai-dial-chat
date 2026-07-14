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
  /** Text color applied to all message bubbles. */
  text?: string;
  /** Border color of the divider line above quick-reply starter buttons. Falls back to `--color-secondary` when omitted. */
  startersDivider?: string;
}

/** Typography overrides for message bubble components. */
export interface MessageBubbleTypography {
  /** Tailwind (or custom) class applied to message text. */
  fontClassName?: string;
}

/** Combined style overrides (colors and typography) for message bubble components. */
export interface MessageBubbleStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: MessageBubbleColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: MessageBubbleTypography;
  /** Extra class name(s) merged onto the outer row wrapper. */
  className?: string;
  /** Extra class name(s) merged onto the bubble element itself. */
  bubbleClassName?: string;
}

/** Localised labels for message bubble components. */
export interface MessageBubbleLabels {
  /** Button label shown when a collapsed user message can be expanded. Defaults to `"Show more"`. */
  showMoreLabel?: string;
  /** Button label shown when an expanded user message can be collapsed. Defaults to `"Show less"`. */
  showLessLabel?: string;
  /** Accessible label for the expand button. Defaults to the `showMoreLabel` value. */
  showMoreAriaLabel?: string;
  /** Accessible label for the collapse button. Defaults to the `showLessLabel` value. */
  showLessAriaLabel?: string;
  /** Accessible label forwarded to each attachment tile/row when it is interactive. */
  attachmentClickLabel?: string;
  /** Accessible label for each attachment row's retry action. */
  attachmentRetryLabel?: string;
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
}

/** Localised labels for the `AssistantMessageBubble` component. */
export interface AssistantMessageBubbleLabels extends MessageBubbleLabels {
  /** Accessible label for the quick-reply buttons list. Defaults to `"Quick reply buttons"`. */
  startersAriaLabel?: string;
  /**
   * Label shown with a shimmer animation while `isStreaming` is true and the message text is still empty.
   * Pass a translated string from the consuming app. Defaults to `'Thinking'`.
   */
  thinkingLabel?: string;
  /** Accessible label for the copy button in code blocks. Forwarded to `MDMessageViewer`. */
  codeBlockCopyLabel?: string;
  /** Accessible label for the copy button after copying. Forwarded to `MDMessageViewer`. */
  codeBlockCopiedLabel?: string;
}

/** Shared props for user and assistant message bubble components. */
interface BaseMessageBubbleProps {
  /** Plain-text (or Markdown) content of the message. */
  text: string;
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
  /** Localised labels for the bubble's toggle button and attachment rows. */
  labels?: MessageBubbleLabels;
  /** Called when the user clicks an attachment tile/row. Passed through to `AttachmentGroup`. */
  onAttachmentClick?: (attachment: DisplayAttachment) => void;
  /**
   * Called with every currently downloadable attachment when the user
   * activates the group's "download all" action. Passed through to
   * `AttachmentGroup`.
   */
  onDownloadAll?: (attachments: DisplayAttachment[]) => void;
  /** Called when the user retries a failed attachment upload. */
  onAttachmentRetry?: (id: string) => void;
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

/** Props accepted by the `UserMessageBubble` component. */
export interface UserMessageBubbleProps extends BaseMessageBubbleProps {
  /** Position within a message group — controls which corner is rounded. Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
  /** Maximum number of text lines shown while a long user message is collapsed. Defaults to `10`. */
  collapsedLineCount?: number;
}

/** Props accepted by the `AssistantMessageBubble` component. */
export interface AssistantMessageBubbleProps extends BaseMessageBubbleProps {
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
  /** Content rendered between the message body and the actions bar (e.g. a stages panel). */
  afterContent?: ReactNode;
  /**
   * Resolved URL for the deployment icon shown in the message header.
   * When absent (e.g. legacy messages without a stored `deploymentId`), no icon is rendered.
   */
  deploymentIconUrl?: string;
  /** Human-readable deployment name shown as the icon's accessible label. */
  deploymentDisplayName?: string;
  /** Syntax highlight color theme for code blocks. Forwarded to `MDMessageViewer`. Defaults to `'dark'`. */
  codeBlockTheme?: CodeBlockTheme;
  /** Localised labels for quick replies, the thinking indicator, and code block copy actions. */
  labels?: AssistantMessageBubbleLabels;
}

/**
 * Props accepted by the `MessageBubble` role-switching wrapper — the union of
 * `AssistantMessageBubbleProps` (the richer variant) with the user-only
 * `position`/`collapsedLineCount` fields, plus the discriminant `role`.
 */
export type MessageBubbleProps = AssistantMessageBubbleProps &
  Pick<UserMessageBubbleProps, 'position' | 'collapsedLineCount'> & {
    /** Whether the message was authored by the user, the assistant, or is a status banner. */
    role: MessageRole;
  };
