import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Per-element className overrides passed to {@link MarkdownRenderer}. */
export interface MarkdownRendererClassNames {
  /** Classes on `<p>` elements. */
  p?: string;
  /** Extra classes on `<ul>` (base: `list-disc pl-5`). */
  ul?: string;
  /** Extra classes on `<ol>` (base: `list-decimal pl-5`). */
  ol?: string;
  /** Extra classes on `<pre>` block code (base: `overflow-x-auto rounded p-3 text-sm`). */
  codeBlock?: string;
  /** Extra classes on inline `<code>` (base: `rounded px-1 py-0.5 font-mono text-sm`). */
  codeInline?: string;
  /** Extra classes on `<blockquote>` (base: `border-l-4 pl-3 opacity-80`). */
  blockquote?: string;
  /** Extra classes on `<a>` (base: `underline opacity-80 hover:opacity-100`). */
  link?: string;
  /** Extra classes on the table wrapper `<div>`. */
  tableWrapper?: string;
  /** Extra classes on `<th>` and `<td>` (base: `border px-3 py-1.5`). */
  tableCell?: string;
  /** Extra classes on `<th>` only (applied alongside `tableCell`). */
  tableHeader?: string;
}

/** Props for {@link MarkdownRenderer}. */
interface MarkdownRendererProps {
  /** Raw markdown string to render. */
  content: string;
  /** Per-element styling classes. Merged with structural base classes inside the component. */
  classNames?: MarkdownRendererClassNames;
  /**
   * Full component overrides merged on top of the built-in map.
   * Use for elements not covered by `classNames` (e.g. `h1`, `h2`, `h3`).
   */
  components?: Components;
}

export const remarkPlugins = [remarkGfm];

/**
 * Shared component definitions for elements whose rendering is identical across
 * all consumers. These are merged after `classNames`-built components and before
 * explicit `components` overrides, so consumers can still override them.
 */
export const defaultMarkdownComponents: Components = {
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
};

const buildMarkdownComponents = (
  cn: MarkdownRendererClassNames,
): Components => ({
  p: ({ children }) => <p className={cn.p}>{children}</p>,
  ul: ({ children }) => (
    <ul className={mergeClasses('list-disc pl-5', cn.ul)}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={mergeClasses('list-decimal pl-5', cn.ol)}>{children}</ol>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-');
    return isBlock ? (
      <pre
        className={mergeClasses(
          'overflow-x-auto rounded p-3 text-sm',
          cn.codeBlock,
        )}
      >
        <code className="font-mono">{children}</code>
      </pre>
    ) : (
      <code
        className={mergeClasses(
          'rounded px-1 py-0.5 font-mono text-sm',
          cn.codeInline,
        )}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote
      className={mergeClasses('border-l-4 pl-3 opacity-80', cn.blockquote)}
    >
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={mergeClasses(
        'underline opacity-80 hover:opacity-100',
        cn.link,
      )}
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className={mergeClasses('overflow-x-auto', cn.tableWrapper)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th
      className={mergeClasses(
        'border px-3 py-1.5 text-left font-semibold',
        cn.tableCell,
        cn.tableHeader,
      )}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className={mergeClasses('border px-3 py-1.5', cn.tableCell)}>
      {children}
    </td>
  ),
});

/** Markdown renderer with GFM support. Styling is driven by `classNames`; structural overrides via `components`. */
export const MarkdownRenderer: FC<MarkdownRendererProps> = memo(
  ({ content, classNames = {}, components }) => (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={{
        ...buildMarkdownComponents(classNames),
        ...defaultMarkdownComponents,
        ...components,
      }}
    >
      {content}
    </ReactMarkdown>
  ),
);
