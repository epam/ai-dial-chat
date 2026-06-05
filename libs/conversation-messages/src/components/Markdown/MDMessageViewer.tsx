import { type FC, memo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer.js';

/** Props for the {@link MDMessageViewer} markdown renderer. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
  /** Enables gradual reveal for appended streaming content. */
  isStreaming?: boolean;
}

/** Renders assistant message content as formatted markdown. */
export const MDMessageViewer: FC<Props> = memo(({ content, isStreaming }) => (
  <MarkdownRenderer
    content={content}
    isStreaming={isStreaming}
    classNames={{
      h1: 'dial-h1-text mb-2',
      h2: 'dial-h2-text mb-2',
      h3: 'dial-h3-text mb-1',
      p: 'mb-2 break-words [overflow-wrap:anywhere] last:mb-0',
      ul: 'mb-2',
      ol: 'mb-2',
      codeBlock:
        'bg-black/20 my-2 max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
      codeFont: 'font-mono whitespace-pre-wrap break-words [overflow-wrap:anywhere]',
      codeInline: 'bg-black/20 break-words [overflow-wrap:anywhere]',
      blockquote: 'border-current/30 my-2',
      link: 'break-words [overflow-wrap:anywhere]',
      tableWrapper: 'my-2',
      tableCell: 'border-white/20',
      tableHeader: 'bg-white/10',
    }}
  />
));
