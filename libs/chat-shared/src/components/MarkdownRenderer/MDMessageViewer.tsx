import { type FC, memo } from 'react';
import type { Components } from 'react-markdown';
import { CodeBlockTheme } from '../../types/code-editor';
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
        h1: 'dial-h1-text mb-3 mt-6 first:mt-0 [text-wrap:balance]',
        h2: 'dial-h2-text mb-2 mt-5 first:mt-0 [text-wrap:balance]',
        h3: 'dial-h3-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
        h4: 'mb-2 mt-4 text-base font-semibold first:mt-0 [text-wrap:balance]',
        h5: 'mb-2 mt-4 text-sm font-semibold first:mt-0 [text-wrap:balance]',
        h6: 'mb-2 mt-4 text-sm font-medium text-secondary first:mt-0 [text-wrap:balance]',
        p: 'mb-3 max-w-[70ch] break-words leading-[1.625] [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0',
        ul: 'mb-3 space-y-1',
        ol: 'mb-3 space-y-1',
        codeInline:
          'mx-0.5 bg-layer-3 px-1.5 text-[0.875em] text-primary break-words [overflow-wrap:anywhere]',
        blockquote: 'my-4 max-w-[70ch]',
        link: 'break-words [overflow-wrap:anywhere]',
        tableWrapper: 'my-4',
        tableHeader: 'bg-layer-3',
      }}
    />
  ),
);
