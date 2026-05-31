import { type FC, memo } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer.js';

/** Props for the {@link MDMessageViewer} markdown renderer. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
}

/** Renders assistant message content as formatted markdown. */
// TODO: review styles and font sizes for all markdown elements
export const MDMessageViewer: FC<Props> = memo(({ content }) => (
  <MarkdownRenderer
    content={content}
    classNames={{
      p: 'mb-2 last:mb-0',
      ul: 'mb-2',
      ol: 'mb-2',
      codeBlock: 'bg-black/20 my-2',
      codeInline: 'bg-black/20',
      blockquote: 'border-current/30 my-2',
      tableWrapper: 'my-2',
      tableCell: 'border-white/20',
      tableHeader: 'bg-white/10',
    }}
    components={{
      h1: ({ children }) => <h1 className="dial-h1-text mb-2">{children}</h1>,
      h2: ({ children }) => <h2 className="dial-h2-text mb-2">{children}</h2>,
      h3: ({ children }) => <h3 className="dial-h3-text mb-1">{children}</h3>,
    }}
  />
));
