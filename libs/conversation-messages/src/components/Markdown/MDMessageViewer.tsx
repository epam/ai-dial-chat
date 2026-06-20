import { type FC, memo } from 'react';
import type { Components } from 'react-markdown';
import type { CodeBlockTheme } from './MarkdownCodeBlock';
import { MarkdownRenderer } from './MarkdownRenderer';

/** Props for the {@link MDMessageViewer} markdown renderer. */
interface Props {
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
}

/** Renders assistant message content as formatted markdown. */
export const MDMessageViewer: FC<Props> = memo(
  ({
    content,
    isStreaming,
    thinkingLabel,
    components,
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    codeBlockTheme,
  }) => (
    <MarkdownRenderer
      content={content}
      isStreaming={isStreaming}
      thinkingLabel={thinkingLabel}
      components={components}
      codeBlockCopyLabel={codeBlockCopyLabel}
      codeBlockCopiedLabel={codeBlockCopiedLabel}
      codeBlockTheme={codeBlockTheme}
      classNames={{
        h1: 'dial-h1-text mb-2',
        h2: 'dial-h2-text mb-2',
        h3: 'dial-h3-text mb-1',
        p: 'mb-2 break-words [overflow-wrap:anywhere] last:mb-0',
        ul: 'mb-2',
        ol: 'mb-2',
        codeInline: 'bg-black/20 break-words [overflow-wrap:anywhere]',
        blockquote: 'border-current/30 my-2',
        link: 'break-words [overflow-wrap:anywhere]',
        tableWrapper: 'my-2',
        tableHeader: 'bg-white/10',
      }}
    />
  ),
);
