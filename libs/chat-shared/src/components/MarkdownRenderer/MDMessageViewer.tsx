import { type FC, memo } from 'react';
import type { Components } from 'react-markdown';
import { CodeBlockTheme } from '../../types/code-editor';
import { DEFAULT_MARKDOWN_CLASS_NAMES } from './markdown-class-names';
import {
  MarkdownRenderer,
  type MarkdownRendererClassNames,
} from './MarkdownRenderer';

/** Props for the {@link MDMessageViewer} markdown renderer. */
interface MDMessageViewerProps {
  /** Raw markdown string to render. */
  content: string;
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
  /** Accessible label for the copy button in code blocks. Forwarded to {@link MarkdownRenderer}. */
  codeBlockCopyLabel?: string;
  /** Accessible label for the copy button after copying. Forwarded to {@link MarkdownRenderer}. */
  codeBlockCopiedLabel?: string;
  /** Syntax highlight color theme for code blocks. Forwarded to {@link MarkdownRenderer}. */
  codeBlockTheme?: CodeBlockTheme;
  /**
   * Per-element typography classes. Defaults to {@link DEFAULT_MARKDOWN_CLASS_NAMES};
   * pass {@link COMPACT_MARKDOWN_CLASS_NAMES} for the smaller body scale. Give a
   * stable reference: this component is memoised.
   */
  classNames?: MarkdownRendererClassNames;
}

/** Renders assistant message content as formatted markdown. */
export const MDMessageViewer: FC<MDMessageViewerProps> = memo(
  ({
    content,
    isStreaming,
    thinkingLabel,
    components,
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    codeBlockTheme,
    classNames = DEFAULT_MARKDOWN_CLASS_NAMES,
  }) => (
    <MarkdownRenderer
      content={content}
      isStreaming={isStreaming}
      thinkingLabel={thinkingLabel}
      components={components}
      codeBlockCopyLabel={codeBlockCopyLabel}
      codeBlockCopiedLabel={codeBlockCopiedLabel}
      codeBlockTheme={codeBlockTheme}
      classNames={classNames}
    />
  ),
);
