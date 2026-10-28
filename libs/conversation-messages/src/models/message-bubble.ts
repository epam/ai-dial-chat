import type {
  CodeBlockTheme,
  DisplayAttachment,
  MarkdownRendererClassNames,
  MessageRole,
  ResponseFormat,
  StarterOption,
  TextSegment,
} from '@epam/ai-dial-chat-shared';
import type { ReactNode, Ref } from 'react';
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
  /** Typography and color classes on the send time shown when `timestamp` is set. Defaults to `'dial-small-text text-secondary'`. */
  timestampClassName?: string;
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
  /** aria-label for each file tile's own download button (rendered when `onDownloadAll` is given). Defaults to `'Download attachment'`. */
  attachmentDownloadLabel?: string;
  /** aria-label for the attachment retry button. */
  attachmentRetryLabel?: string;
  /** aria-label for the attachment open-in-new-tab button. */
  attachmentOpenInNewTabLabel?: string;
  /** Bold prefix for the status banner. Used when `role === MessageRole.Status`. Defaults to `"Model switched."`. */
  statusTitleText?: string;
  /** Body text for the status banner. Required when `role === MessageRole.Status`. */
  statusBodyText?: string;
}

/** Localised labels for markdown content (code blocks, tables, formulas) inside a message bubble. */
export interface MarkdownContentLabels {
  /** aria-label for the code block copy button. */
  codeBlockCopyLabel?: string;
  /** aria-label for the code block copy button after copying. */
  codeBlockCopiedLabel?: string;
  /** aria-label for the code block download button. */
  codeBlockDownloadLabel?: string;
  /** Label for the copy action on a Markdown table (copies as Markdown format). */
  tableCopyLabel?: string;
  /** Status announced after a Markdown table has been copied. */
  tableCopiedLabel?: string;
  /** Label for downloading a Markdown table as CSV. */
  tableDownloadCsvLabel?: string;
  /** Label for opening a Markdown table in the canvas. */
  tableOpenInCanvasLabel?: string;
  /** Filename used when downloading a Markdown table as CSV. */
  tableDownloadFilename?: string;
  /** Accessible label for a Markdown table's scrollable region. */
  tableScrollRegionAriaLabel?: string;
  /** Accessible label for a block formula's scrollable region. */
  mathScrollRegionAriaLabel?: string;
}

/** Localised labels for the `UserMessageBubble` component. */
export interface UserMessageBubbleLabels
  extends MessageBubbleLabels, MarkdownContentLabels {}

/** Localised labels for the `AssistantMessageBubble` component. */
export interface AssistantMessageBubbleLabels
  extends MessageBubbleLabels, MarkdownContentLabels {
  /** aria-label for the quick-reply list. Defaults to `"Quick reply buttons"`. */
  startersAriaLabel?: string;
  /** Shimmer placeholder shown while streaming and message text is empty. Defaults to `'Thinking'`. */
  thinkingLabel?: string;
  /** Fallback aria-label for the deployment icon. Defaults to `'AI'`. */
  deploymentIconFallbackLabel?: string;
}

/** Shared props for user and assistant message bubble components. */
interface BaseMessageBubbleProps {
  /** Ref to the text body, excluding attachment trays, actions and host slots. */
  contentRef?: Ref<HTMLDivElement>;
  /** Plain-text (or Markdown) content of the message. When absent, the bubble renders for `beforeContent` alone. */
  text?: string;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: MessageBubbleStyles;
  /** Props for the `MessageActions` bar below the bubble. */
  actions?: MessageActionsProps;
  /** Shows the actions bar permanently instead of on group hover only. */
  hasAlwaysVisibleActions?: boolean;
  /** ISO-8601 send time. When set, a relative time ("3 hours ago") with a full-date tooltip is shown on the outer edge of the actions row, revealed on hover or focus (always on devices without hover). */
  timestamp?: string;
  /** BCP 47 locale for the send time. Defaults to the runtime's default locale. */
  locale?: string;
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
  /** Whether an attachment can be downloaded; `false` hides its tile's download button and leaves it out of "download all". Defaults to every attachment being downloadable. */
  isAttachmentDownloadable?: (attachment: DisplayAttachment) => boolean;
  /** Fires when a failed attachment upload is retried. */
  onAttachmentRetry?: (id: string) => void;
  /** ID of the attachment currently open in the canvas panel, if any. Renders that tile's selected visual state. */
  selectedAttachmentId?: string;
  /** Per-element markdown typography classes. Defaults to the renderer's full-size scale; pass `COMPACT_MARKDOWN_CLASS_NAMES` for the smaller body scale. */
  markdownClassNames?: MarkdownRendererClassNames;
  /**
   * Rewrites markdown `href`/`src` values before they are rendered. Forwarded
   * to `MDMessageViewer`. Hosts use this to map DIAL file ids to download URLs.
   * Defaults to no extra rewrite.
   */
  markdownUrlTransform?: (url: string) => string;
  /** Syntax highlight theme for code blocks. Defaults to `'dark'`. */
  codeBlockTheme?: CodeBlockTheme;
  /** Opens serialized Markdown table content in the host canvas. */
  tableOnOpenInCanvas?: (markdown: string) => void;
}

/** Props for `UserMessageBubble`. */
export interface UserMessageBubbleProps extends BaseMessageBubbleProps {
  /** Corner rounding position within a message group. Defaults to `BubblePosition.Bottom`. */
  position?: BubblePosition;
  /** Maximum number of text lines shown while a long user message is collapsed. Defaults to `10`. */
  collapsedLineCount?: number;
  /**
   * Ordered content rendered in place of `text` when present: markdown
   * string runs interleaved with inline segments (e.g. skill-mention chips),
   * each rendered at its position within the markdown output, or as its
   * literal `text` inside code and link text. `text` is still required
   * alongside this: it remains the identity input for the collapse state
   * (`useCollapsedText`). Absent renders `text` as markdown directly.
   */
  textSegments?: TextSegment[];
  /** Localised labels for the toggle button, attachment rows, and markdown code/table actions. */
  labels?: UserMessageBubbleLabels;
}

/** Props for `AssistantMessageBubble`. */
export interface AssistantMessageBubbleProps extends BaseMessageBubbleProps {
  /**
   * Conversation response format. `ResponseFormat.PlainText` renders the
   * message body verbatim — no Markdown pipeline, so a table, a heading, or
   * `**bold**` reaches the reader exactly as the model wrote it — and the
   * markdown-only props below stop applying. Defaults to
   * `ResponseFormat.Markdown`.
   */
  responseFormat?: ResponseFormat;
  /**
   * Content rendered at the inline-start of the message's first markdown
   * block's first line, which word-flows after it (e.g. used-skill chips —
   * inline-level content no taller than a text line). Overlaid on the first
   * line, which indents past it; an assistant message with no text renders
   * the slot on its own line — above the streaming placeholder while the
   * first token has not arrived yet. May itself be an array of elements
   * (e.g. one `ChatSkill` per mention) — React renders `ReactNode[]` as a
   * sibling sequence with no extra wrapper needed.
   */
  beforeContent?: ReactNode;
  /** react-markdown component overrides. Use to inject custom renderers (e.g. citation markers) into markdown elements. */
  markdownComponents?: Components;
  /** Quick-reply buttons rendered below the message text when non-empty. */
  starters?: StarterOption[];
  /** Fires with the clicked `StarterOption`. */
  onSelectStarter?: (starter: StarterOption) => void;
  /** Content rendered between the message body and the actions bar (e.g. a stages panel). */
  afterContent?: ReactNode;
  /** When `false`, no thinking placeholder renders while streaming before the first token, so `afterContent` starts level with the avatar. Defaults to `true`. */
  hasThinkingPlaceholder?: boolean;
  /** Deployment icon URL. When absent, no icon is rendered. */
  deploymentIconUrl?: string;
  /** Deployment name used as the icon's accessible label. */
  deploymentDisplayName?: string;
  /** Localised labels for quick replies, the thinking indicator, and code block copy actions. */
  labels?: AssistantMessageBubbleLabels;
}

/** Props for `MessageBubble` — `AssistantMessageBubbleProps` plus user-only fields and `role`. */
export type MessageBubbleProps = AssistantMessageBubbleProps &
  Pick<
    UserMessageBubbleProps,
    'position' | 'collapsedLineCount' | 'textSegments'
  > & {
    /** Message author/type: user, assistant, or status banner. */
    role: MessageRole;
  };
