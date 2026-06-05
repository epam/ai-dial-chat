import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { type FC, memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStreamedMarkdownContent } from '../../hooks/useStreamedMarkdownContent.js';
import styles from './MarkdownRenderer.module.scss';

/** Per-element className overrides passed to {@link MarkdownRenderer}. */
export interface MarkdownRendererClassNames {
  /** Class on `<h1>`. */
  h1?: string;
  /** Class on `<h2>`. */
  h2?: string;
  /** Class on `<h3>`. */
  h3?: string;
  /** Classes on `<p>` elements. */
  p?: string;
  /** Extra classes on `<ul>` (base: `list-disc pl-5`). */
  ul?: string;
  /** Extra classes on `<ol>` (base: `list-decimal pl-5`). */
  ol?: string;
  /** Typography class for `<strong>`. Defaults to `'font-semibold'`. */
  strong?: string;
  /** Typography class for `<em>`. Defaults to `'italic'`. */
  em?: string;
  /** Extra classes on `<pre>` block code (base: `overflow-x-auto rounded p-3`). */
  codeBlock?: string;
  /** Typography class for the `<pre>` block (size). Defaults to `'text-sm'`. */
  codeBlockFont?: string;
  /** Typography class for the `<code>` element inside a code block. Defaults to `'font-mono'`. */
  codeFont?: string;
  /** Extra classes on inline `<code>` (base: `rounded px-1 py-0.5`). */
  codeInline?: string;
  /** Typography class for inline `<code>`. Defaults to `'font-mono text-sm'`. */
  codeInlineFont?: string;
  /** Extra classes on `<blockquote>` (base: `border-l-4 pl-3 opacity-80`). */
  blockquote?: string;
  /** Extra classes on `<a>` (base: `underline opacity-80 hover:opacity-100`). */
  link?: string;
  /** Extra classes on the table wrapper `<div>`. */
  tableWrapper?: string;
  /** Typography class for `<table>`. Defaults to `'text-sm'`. */
  tableFont?: string;
  /** Extra classes on `<th>` and `<td>` (base: `border px-3 py-1.5`). */
  tableCell?: string;
  /** Extra classes on `<th>` only (applied alongside `tableCell`). */
  tableHeader?: string;
  /** Typography class for `<th>` cells. Defaults to `'font-semibold'`. */
  tableHeaderFont?: string;
}

/** Props for {@link MarkdownRenderer}. */
export interface MarkdownRendererProps {
  /** Raw markdown string to render. */
  content: string;
  /** When true, appended content is revealed gradually for smoother streaming updates. */
  isStreaming?: boolean;
  /** Reveal speed used while `isStreaming` is true. Defaults to 120 characters per second. */
  streamCharactersPerSecond?: number;
  /** Per-element styling classes. Merged with structural base classes inside the component. */
  classNames?: MarkdownRendererClassNames;
  /**
   * Full component overrides merged on top of the built-in map.
   * Use for elements not covered by `classNames`.
   */
  components?: Components;
  /**
   * Label shown with a shimmer animation while `isStreaming` is true and no content has arrived yet.
   * Defaults to `'Thinking'`. Pass a translated string from the consuming app.
   */
  thinkingLabel?: string;
}

/** GFM remark plugins list, shared across all markdown instances. */
export const remarkPlugins = [remarkGfm];

/**
 * Shared component definitions for elements whose rendering is identical across
 * all consumers. These are merged after `classNames`-built components and before
 * explicit `components` overrides, so consumers can still override them.
 */
export const defaultMarkdownComponents: Components = {
  li: ({ children }) => <li className="mb-2">{children}</li>,
};

const buildMarkdownComponents = (
  cn: MarkdownRendererClassNames,
): Components => ({
  h1: ({ children }) => <h1 className={cn.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={cn.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={cn.h3}>{children}</h3>,
  p: ({ children }) => <p className={cn.p}>{children}</p>,
  ul: ({ children }) => (
    <ul className={mergeClasses('list-disc pl-5', cn.ul)}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={mergeClasses('list-decimal pl-5', cn.ol)}>{children}</ol>
  ),
  strong: ({ children }) => (
    <strong className={cn.strong ?? 'font-semibold'}>{children}</strong>
  ),
  em: ({ children }) => <em className={cn.em ?? 'italic'}>{children}</em>,
  pre: ({ children }) => (
    <pre
      className={mergeClasses(
        'overflow-x-auto rounded p-3',
        cn.codeBlockFont ?? 'text-sm',
        cn.codeBlock,
      )}
    >
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock =
      className?.includes('language-') || String(children).includes('\n');
    return isBlock ? (
      <code className={mergeClasses(cn.codeFont ?? 'font-mono', className)}>
        {children}
      </code>
    ) : (
      <code
        className={mergeClasses(
          'rounded px-1 py-0.5',
          cn.codeInlineFont ?? 'font-mono text-sm',
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
      <table
        className={mergeClasses(
          'w-full border-collapse',
          cn.tableFont ?? 'text-sm',
        )}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      className={mergeClasses(
        'border px-3 py-1.5 text-left',
        cn.tableHeaderFont ?? 'font-semibold',
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
  ({
    content,
    isStreaming,
    streamCharactersPerSecond,
    classNames = {},
    components,
    thinkingLabel = 'Thinking',
  }) => {
    const displayedContent = useStreamedMarkdownContent(
      content,
      isStreaming,
      streamCharactersPerSecond,
    );

    if (isStreaming && !displayedContent) {
      return <span className={styles.thinking}>{thinkingLabel}</span>;
    }

    return (
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          ...buildMarkdownComponents(classNames),
          ...defaultMarkdownComponents,
          ...components,
        }}
      >
        {displayedContent}
      </ReactMarkdown>
    );
  },
);
