import { memo, useMemo, type FC } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStreamedMarkdownContent } from '../../hooks/useStreamedMarkdownContent';
import { CodeBlockTheme } from '../../types/code-editor';
import { buildCssVars } from '../../utils/build-css-vars';
import { mergeClasses } from '../../utils/merge-class';
import { MarkdownCodeBlock } from './CodeBlock/CodeBlock';
import styles from './MarkdownRenderer.module.scss';
import {
  MarkdownTable,
  type MarkdownTableClassNames,
} from './Table/MarkdownTable';
import tableStyles from './Table/MarkdownTable.module.scss';
import { MarkdownTaskCheckbox } from './TaskCheckbox/MarkdownTaskCheckbox';

/** Per-element className overrides passed to {@link MarkdownRenderer}. */
export interface MarkdownRendererClassNames extends MarkdownTableClassNames {
  /** Class on `<h1>`. */
  h1?: string;
  /** Class on `<h2>`. */
  h2?: string;
  /** Class on `<h3>`. */
  h3?: string;
  /** Class on `<h4>`. */
  h4?: string;
  /** Class on `<h5>`. */
  h5?: string;
  /** Class on `<h6>`. */
  h6?: string;
  /** Classes on `<p>` elements. */
  p?: string;
  /** Extra classes on `<ul>` (base: `list-disc ps-5`). */
  ul?: string;
  /** Extra classes on `<ol>` (base: `list-decimal ps-5`). */
  ol?: string;
  /** Typography class for `<strong>`. Defaults to `'font-semibold'`. */
  strong?: string;
  /** Typography class for `<em>`. Defaults to `'italic'`. */
  em?: string;
  /**
   * @deprecated The `<pre>` wrapper is now a fragment passthrough; this class no longer applies
   * to fenced code blocks. Migrate to `codeBlockContainer` for the block container.
   */
  codeBlock?: string;
  /** Extra classes on the {@link MarkdownCodeBlock} outer container. */
  codeBlockContainer?: string;
  /** Extra classes on the {@link MarkdownCodeBlock} header bar. */
  codeBlockHeader?: string;
  /** Typography class for the `<code>` element inside a code block. Defaults to `'dial-code-text'`. */
  codeFont?: string;
  /** Extra classes on inline `<code>` (base: `rounded px-1 py-0.5`). */
  codeInline?: string;
  /** Typography class for inline `<code>`. Defaults to `'dial-code-text'`. */
  codeInlineFont?: string;
  /** Extra classes on `<blockquote>` (base uses a logical start border and padding). */
  blockquote?: string;
  /** Extra classes on `<a>` (base uses the accent text color and an offset underline). */
  link?: string;
  /** Extra classes on `<hr>` separators. */
  hr?: string;
  /** Extra classes on deleted text rendered by GFM. */
  del?: string;
  /** Extra classes on `<th>` and `<td>` (base includes borders, spacing, and text wrapping). */
  tableCell?: string;
  /** Extra classes on `<td>` only (applied before `tableCell`, e.g. a body-cell background). */
  tableBodyCell?: string;
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
  /** Per-element styling classes. Merged with structural base classes inside the component. Defaults to no overrides (`{}`). */
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
  /** Accessible label for the copy button in code blocks. Defaults to `'Copy code'`. */
  codeBlockCopyLabel?: string;
  /** Accessible label for the copy button after copying. Defaults to `'Copied!'`. */
  codeBlockCopiedLabel?: string;
  /** Syntax highlight color theme for code blocks and tables. Defaults to `'dark'`. */
  codeBlockTheme?: CodeBlockTheme;
  /** Color overrides applied as CSS custom properties. */
  colors?: MarkdownRendererColors;
  /**
   * Accessible label announced for a table's horizontally scrollable region.
   * Defaults to `'Scrollable table'`.
   */
  tableScrollRegionAriaLabel?: string;
}

/** CSS custom-property overrides for the `MarkdownRenderer` component. */
export interface MarkdownRendererColors {
  /** Primary color of the "thinking" shimmer gradient. */
  thinkingPrimary?: string;
  /** Secondary color of the "thinking" shimmer gradient. */
  thinkingSecondary?: string;
  /** Border color for `<hr>` separators and table cell borders. */
  border?: string;
}

/** Stable empty classNames object used as the default when no `classNames` prop is passed. */
const EMPTY_CLASS_NAMES: MarkdownRendererClassNames = {};

/**
 * Shared component definitions for elements whose rendering is identical across
 * all consumers. These are merged after `classNames`-built components and before
 * explicit `components` overrides, so consumers can still override them.
 */
export const defaultMarkdownComponents: Components = {
  li: ({ children }) => <li className="mb-1.5 last:mb-0">{children}</li>,
};

/** Minimal shape shared by hast text and element nodes, enough to read a cell's plain text. */
interface HastTextLike {
  type: string;
  value?: string;
  children?: HastTextLike[];
}

interface MarkdownAstNode {
  type: string;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  position?: {
    start?: {
      offset?: number;
    };
  };
  children?: MarkdownAstNode[];
}

interface VFileLike {
  value?: unknown;
}

/** Recursively concatenates the text content of a hast node. */
const getNodeText = (node: HastTextLike | undefined): string => {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(getNodeText).join('');
};

const getSourceLineAtOffset = (source: string, offset: number): string => {
  const lineEnd = source.indexOf('\n', offset);
  return source.slice(offset, lineEnd === -1 ? undefined : lineEnd);
};

const isFencedCodeBlock = (node: MarkdownAstNode, source: string): boolean => {
  if (node.lang || node.meta) return true;

  const offset = node.position?.start?.offset;
  if (typeof offset !== 'number') return true;

  const openingLine = getSourceLineAtOffset(source, offset);
  return /^[ ]{0,3}(```|~~~)/.test(openingLine);
};

const toParagraphNode = (node: MarkdownAstNode): MarkdownAstNode => ({
  type: 'paragraph',
  position: node.position,
  children: [
    {
      type: 'text',
      value: node.value ?? '',
    },
  ],
});

const replaceIndentedCodeBlocks = (
  node: MarkdownAstNode,
  source: string,
): MarkdownAstNode => {
  if (node.type === 'code') {
    return isFencedCodeBlock(node, source) ? node : toParagraphNode(node);
  }

  if (node.children) {
    node.children = node.children.map((child) =>
      replaceIndentedCodeBlocks(child, source),
    );
  }

  return node;
};

const remarkPlainTextIndentedCodeBlocks =
  () => (tree: MarkdownAstNode, file: VFileLike) => {
    if (typeof file.value !== 'string') return;
    replaceIndentedCodeBlocks(tree, file.value);
  };

/** GFM remark plugins list, shared across all markdown instances. */
const remarkPlugins = [remarkGfm, remarkPlainTextIndentedCodeBlocks];

const buildMarkdownComponents = (
  cn: MarkdownRendererClassNames,
  isStreaming?: boolean,
  codeBlockCopyLabel?: string,
  codeBlockCopiedLabel?: string,
  codeBlockTheme?: CodeBlockTheme,
  tableScrollRegionAriaLabel?: string,
): Components => ({
  h1: ({ children }) => <h1 className={cn.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={cn.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={cn.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={cn.h4}>{children}</h4>,
  h5: ({ children }) => <h5 className={cn.h5}>{children}</h5>,
  h6: ({ children }) => <h6 className={cn.h6}>{children}</h6>,
  p: ({ children }) => <p className={cn.p}>{children}</p>,
  ul: ({ children }) => (
    <ul className={mergeClasses('list-disc ps-5', cn.ul)}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={mergeClasses('list-decimal ps-5', cn.ol)}>{children}</ol>
  ),
  strong: ({ children }) => (
    <strong className={cn.strong ?? 'font-semibold'}>{children}</strong>
  ),
  em: ({ children }) => <em className={cn.em ?? 'italic'}>{children}</em>,
  pre: ({ children }) => <>{children}</>,
  code: ({ children, className }) => {
    const language = /language-(\w+)/.exec(className ?? '')?.[1] ?? '';
    const raw = String(children);
    const isBlock = !!language || raw.includes('\n');

    if (isBlock) {
      return (
        <MarkdownCodeBlock
          language={language}
          value={raw.replace(/\n$/, '')}
          isStreaming={isStreaming}
          theme={codeBlockTheme}
          copyLabel={codeBlockCopyLabel}
          copiedLabel={codeBlockCopiedLabel}
          containerClassName={cn.codeBlockContainer}
          headerClassName={cn.codeBlockHeader}
          codeClassName={cn.codeFont}
        />
      );
    }

    return (
      <code
        className={mergeClasses(
          'rounded px-1 py-0.5',
          cn.codeInlineFont ?? 'dial-code-text',
          cn.codeInline,
        )}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote
      className={mergeClasses(
        'border-s-2 border-primary py-1 ps-4 text-secondary',
        cn.blockquote,
      )}
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
        'decoration-current/60 text-accent-primary underline underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--stroke-focus,#EEF1F7)]',
        cn.link,
      )}
    >
      {children}
    </a>
  ),
  hr: () => (
    <hr
      className={mergeClasses('my-5 border-t', styles.secondaryBorder, cn.hr)}
    />
  ),
  del: ({ children }) => (
    <del className={mergeClasses('opacity-75', cn.del)}>{children}</del>
  ),
  input: ({ type, checked }) =>
    type === 'checkbox' ? (
      <MarkdownTaskCheckbox checked={checked ?? false} />
    ) : null,
  table: ({ children }) => (
    <MarkdownTable
      classNames={cn}
      scrollRegionAriaLabel={tableScrollRegionAriaLabel}
    >
      {children}
    </MarkdownTable>
  ),
  tr: ({ children, node }) => {
    const cells = (node?.children.filter((child) => child.type === 'element') ??
      []) as (HastTextLike & { tagName?: string })[];
    const isHeaderRow = cells.some((cell) => cell.tagName === 'th');
    const nonEmptyCount = cells.filter(
      (cell) => getNodeText(cell).trim().length > 0,
    ).length;
    const isSectionRow =
      !isHeaderRow && cells.length > 1 && nonEmptyCount === 1;

    return (
      <tr
        className={mergeClasses(
          tableStyles.row,
          isSectionRow && tableStyles.sectionRow,
        )}
      >
        {children}
      </tr>
    );
  },
  th: ({ children }) => (
    <th
      scope="col"
      className={mergeClasses(
        'sticky top-0 z-[2] max-w-96 whitespace-normal break-words border-b px-3 py-2.5 text-start [overflow-wrap:anywhere]',
        tableStyles.rowDivider,
        tableStyles.tableHeaderCell,
        cn.tableHeaderFont ??
          'dial-tiny-semi-text uppercase tracking-wider text-secondary',
        cn.tableCell,
        cn.tableHeader,
      )}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      className={mergeClasses(
        'max-w-96 whitespace-normal break-words border-b px-3 py-2.5 align-top [overflow-wrap:anywhere]',
        tableStyles.rowDivider,
        cn.tableBodyCell,
        cn.tableCell,
      )}
    >
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
    classNames = EMPTY_CLASS_NAMES,
    components,
    thinkingLabel = 'Thinking',
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    codeBlockTheme,
    colors,
    tableScrollRegionAriaLabel,
  }) => {
    const displayedContent = useStreamedMarkdownContent(
      content,
      isStreaming,
      streamCharactersPerSecond,
    );

    const cssVars = buildCssVars({
      '--cm-thinking-inverted': colors?.thinkingPrimary,
      '--cm-thinking-secondary': colors?.thinkingSecondary,
      '--cm-markdown-border': colors?.border,
    });

    const mergedComponents = useMemo(
      () => ({
        ...buildMarkdownComponents(
          classNames,
          isStreaming,
          codeBlockCopyLabel,
          codeBlockCopiedLabel,
          codeBlockTheme,
          tableScrollRegionAriaLabel,
        ),
        ...defaultMarkdownComponents,
        ...components,
      }),
      [
        classNames,
        isStreaming,
        codeBlockCopyLabel,
        codeBlockCopiedLabel,
        codeBlockTheme,
        tableScrollRegionAriaLabel,
        components,
      ],
    );

    if (isStreaming && !displayedContent) {
      return (
        <span className={styles.thinking} style={cssVars}>
          {thinkingLabel}
        </span>
      );
    }

    return (
      <div style={cssVars}>
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          components={mergedComponents}
        >
          {displayedContent}
        </ReactMarkdown>
      </div>
    );
  },
);
