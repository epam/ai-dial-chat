import { type FC, memo } from 'react';
import type { Components } from 'react-markdown';
import { CodeBlockTheme } from '../../types/code-editor';
import { DEFAULT_MARKDOWN_CLASS_NAMES } from './markdown-class-names';
import {
  MarkdownRenderer,
  type MarkdownRendererClassNames,
} from './MarkdownRenderer';
import { PlainTextRenderer } from './PlainTextRenderer';
import type { MarkdownTableActionLabels } from './Table/MarkdownTable';

/** Props for the {@link MDMessageViewer} markdown renderer. */
interface MDMessageViewerProps {
  /** Raw markdown string to render. */
  content: string;
  /**
   * Renders `content` verbatim as escaped plain text instead of running the
   * Markdown pipeline — the conversation's `plain_text` response format.
   * Markdown-only props (`components`, `urlTransform`, the code-block and
   * table labels) do not apply while it is set. Defaults to `false`.
   */
  isPlainText?: boolean;
  /** Enables gradual reveal for appended streaming content. */
  isStreaming?: boolean;
  /**
   * Label shown while `isStreaming` is true and no content has arrived yet.
   * Forwarded to {@link MarkdownRenderer}. Defaults to `'Thinking'`.
   */
  thinkingLabel?: string;
  /**
   * Additional react-markdown component overrides merged on top of the
   * built-in map. Use to inject custom React nodes (e.g. citation markers)
   * into specific markdown elements without modifying the viewer directly.
   */
  components?: Components;
  /**
   * Rewrites `href` and `src` values before they are rendered. Forwarded to
   * {@link MarkdownRenderer}. Defaults to no extra rewrite.
   */
  urlTransform?: (url: string) => string;
  /** Accessible label for the copy button in code blocks. Forwarded to {@link MarkdownRenderer}. */
  codeBlockCopyLabel?: string;
  /** Accessible label for the copy button after copying. Forwarded to {@link MarkdownRenderer}. */
  codeBlockCopiedLabel?: string;
  /** Syntax highlight color theme for code blocks. Forwarded to {@link MarkdownRenderer}. */
  codeBlockTheme?: CodeBlockTheme;
  /** Localized labels for Markdown table actions. Forwarded to {@link MarkdownRenderer}. */
  tableActionLabels?: MarkdownTableActionLabels;
  /** Filename used when downloading a Markdown table as CSV. Forwarded to {@link MarkdownRenderer}. */
  tableDownloadFilename?: string;
  tableOnOpenInCanvas?: (markdown: string) => void;
  /** Accessible label for a table's scrollable region. Forwarded to {@link MarkdownRenderer}. */
  tableScrollRegionAriaLabel?: string;
  /**
   * Per-element typography classes. Defaults to {@link DEFAULT_MARKDOWN_CLASS_NAMES};
   * pass {@link COMPACT_MARKDOWN_CLASS_NAMES} for the smaller body scale. Give a
   * stable reference: this component is memoised.
   */
  classNames?: MarkdownRendererClassNames;
}

/** Renders assistant message content as formatted markdown, or as escaped plain text when `isPlainText` is set. */
export const MDMessageViewer: FC<MDMessageViewerProps> = memo(
  ({
    content,
    isPlainText,
    isStreaming,
    thinkingLabel,
    components,
    urlTransform,
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    codeBlockTheme,
    tableActionLabels,
    tableDownloadFilename,
    tableOnOpenInCanvas,
    tableScrollRegionAriaLabel,
    classNames = DEFAULT_MARKDOWN_CLASS_NAMES,
  }) =>
    isPlainText ? (
      <PlainTextRenderer
        content={content}
        isStreaming={isStreaming}
        thinkingLabel={thinkingLabel}
        classNames={classNames}
      />
    ) : (
      <MarkdownRenderer
        content={content}
        isStreaming={isStreaming}
        thinkingLabel={thinkingLabel}
        components={components}
        urlTransform={urlTransform}
        codeBlockCopyLabel={codeBlockCopyLabel}
        codeBlockCopiedLabel={codeBlockCopiedLabel}
        codeBlockTheme={codeBlockTheme}
        tableActionLabels={tableActionLabels}
        tableDownloadFilename={tableDownloadFilename}
        tableOnOpenInCanvas={tableOnOpenInCanvas}
        tableScrollRegionAriaLabel={tableScrollRegionAriaLabel}
        classNames={classNames}
      />
    ),
);
