import { type FC, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Props for the {@link MDMessageViewer} markdown renderer. */
interface Props {
  /** Raw markdown string to render. */
  content: string;
}

const remarkPlugins = [remarkGfm];

/** Renders assistant message content as formatted markdown. */
// TODO: review styles and font sizes for all markdown elements
export const MDMessageViewer: FC<Props> = memo(({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={{
        h1: ({ children }) => <h1 className="dial-h1-text mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="dial-h2-text mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="dial-h3-text mb-1">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mb-2 list-disc pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal pl-5">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          return isBlock ? (
            <pre className="bg-black/20 my-2 overflow-x-auto rounded p-3 text-sm">
              <code className={className}>{children}</code>
            </pre>
          ) : (
            <code className="bg-black/20 rounded px-1 py-0.5 font-mono text-sm">
              {children}
            </code>
          );
        },
        blockquote: ({ children }) => (
          <blockquote className="border-current/30 my-2 border-l-4 pl-3 opacity-80">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline opacity-80 hover:opacity-100"
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-white/20 bg-white/10 border px-3 py-1.5 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-white/20 border px-3 py-1.5">{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
