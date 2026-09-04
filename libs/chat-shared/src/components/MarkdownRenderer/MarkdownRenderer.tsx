import 'katex/dist/katex.min.css';
import { memo, useMemo, type FC } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { useStreamedMarkdownContent } from '../../hooks/useStreamedMarkdownContent';
import { CodeBlockTheme } from '../../types/code-editor';
import { buildCssVars } from '../../utils/build-css-vars';
import { preprocessLaTeX } from '../../utils/latex';
import { mergeClasses } from '../../utils/merge-class';
import { MarkdownCodeBlock } from './CodeBlock/CodeBlock';
import styles from './MarkdownRenderer.module.scss';
import { MarkdownMathBlock } from './Math/MarkdownMathBlock';
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
  /** Typography class for `<strong>`. Defaults to `'dial-body-paragraph-semi-text'` — the semibold step matching the default `p` class. */
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
  /** Typography class for `<th>` cells. Defaults to `'dial-tiny-lead-semi-text'`. Text color is set separately via `colors.tableHeaderText`. */
  tableHeaderFont?: string;
  /** Extra classes on the scrollable wrapper around block (display) LaTeX formulas. */
  mathBlock?: string;
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
  /** Extra rehype plugins, applied after the built-in KaTeX pass. Defaults to none. */
  rehypePlugins?: NonNullable<Options['rehypePlugins']>;
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
  /** Accessible label for a table's horizontally scrollable region. Defaults to `'Scrollable table'`. */
  tableScrollRegionAriaLabel?: string;
  /** Accessible label for a block formula's horizontally scrollable region. Defaults to `'Scrollable formula'`. */
  mathScrollRegionAriaLabel?: string;
}

/** CSS custom-property overrides for the `MarkdownRenderer` component. */
export interface MarkdownRendererColors {
  /** Primary color of the "thinking" shimmer gradient. */
  thinkingPrimary?: string;
  /** Secondary color of the "thinking" shimmer gradient. */
  thinkingSecondary?: string;
  /** Border color for `<hr>` separators and table cell borders. */
  border?: string;
  /** Border color for the `<blockquote>` start border. Defaults to `--stroke-primary`. */
  blockquoteBorder?: string;
  /** Text color for `<blockquote>` content. Defaults to `--text-secondary`. */
  blockquoteText?: string;
  /** Text color for `<a>` links. Defaults to `--text-accent`. */
  linkText?: string;
  /** Focus-visible outline color for `<a>` links. Defaults to `--stroke-focus-black`. */
  linkFocus?: string;
  /** Text color for `<th>` table header cells. Defaults to `--text-secondary`. */
  tableHeaderText?: string;
  /** Text color for `<h6>` headings. Defaults to `--text-secondary`. */
  headingSixText?: string;
  /** Background color for inline `<code>` spans. Defaults to `--bg-layer-raised`. */
  inlineCodeBackground?: string;
  /** Text color for inline `<code>` spans. Defaults to `--text-primary`. */
  inlineCodeText?: string;
}

/**
 * Remark plugins list, shared across all markdown instances: GFM support,
 * soft-break-to-hard-break conversion so single newlines render as visible
 * line breaks, then math-span detection for KaTeX rendering.
 */
const remarkPlugins: Options['remarkPlugins'] = [
  remarkGfm,
  remarkBreaks,
  [remarkMath, { singleDollarTextMath: false }],
];

/**
 * MathML element names produced by `rehypeKatex`'s `output: 'mathml'` mode.
 * `rehype-sanitize`'s default schema doesn't know these tags, so they must be
 * added explicitly or KaTeX output gets stripped.
 * Source: https://developer.mozilla.org/en-US/docs/Web/MathML/Reference/Element
 */
const mathMLTags = [
  'math',
  'maction',
  'annotation',
  'annotation-xml',
  'menclose',
  'merror',
  'mfenced',
  'mfrac',
  'mi',
  'mmultiscripts',
  'mn',
  'mo',
  'mover',
  'mpadded',
  'mphantom',
  'mroot',
  'mrow',
  'ms',
  'semantics',
  'mspace',
  'msqrt',
  'mstyle',
  'msub',
  'msup',
  'msubsup',
  'mtable',
  'mtd',
  'mtext',
  'mtr',
  'munder',
  'munderover',
];

/**
 * Presentation attributes carried by `rehypeKatex`'s MathML output, per tag.
 * `rehype-sanitize` drops every attribute its schema does not list, and the
 * default schema knows no MathML: without these, `display="block"` is stripped
 * from `<math>` and every display formula silently renders as inline math.
 * All of them are layout-only — nothing here can carry script or a URL.
 */
const mathMLAttributes: Record<string, string[]> = {
  math: ['display', 'xmlns'],
  annotation: ['encoding'],
  mfrac: ['linethickness'],
  mi: ['mathvariant'],
  mo: ['fence', 'minsize', 'stretchy'],
  mover: ['accent'],
  mpadded: ['height', 'lspace', 'width'],
  mspace: ['width'],
  mstyle: ['displaystyle', 'mathcolor', 'scriptlevel'],
  mtable: ['columnalign', 'columnspacing', 'rowspacing', 'width'],
  mtd: ['width'],
};

/**
 * KaTeX rehype plugin list, shared across all markdown instances.
 *
 * `rehypeRaw` re-parses raw HTML left as literal text by `remark` (e.g. a
 * model emitting `<br>` for a line break) into real hast elements, so it
 * must run before both `rehypeKatex` and `rehypeSanitize`. `rehypeSanitize`
 * strips anything dangerous that raw HTML pass could have introduced —
 * required whenever raw HTML is allowed through.
 */
const baseRehypePlugins: NonNullable<Options['rehypePlugins']> = [
  rehypeRaw,
  [rehypeKatex, { output: 'mathml', strict: false }],
  [
    rehypeSanitize,
    {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames ?? []), ...mathMLTags],
      attributes: {
        ...defaultSchema.attributes,
        ...mathMLAttributes,
        code: [...(defaultSchema.attributes?.code ?? []), ['className']],
        /* Only KaTeX's own wrapper classes — a class from raw model HTML is
           still dropped. `katex` is what marks a formula for MarkdownMathBlock. */
        span: [
          ...(defaultSchema.attributes?.span ?? []),
          ['className', 'katex', 'katex-error'],
        ],
      },
    },
  ],
];

/** Stable empty plugin list used as the default when no extra plugins are passed. */
const EMPTY_REHYPE_PLUGINS: NonNullable<Options['rehypePlugins']> = [];

/** Stable empty classNames object used as the default when no `classNames` prop is passed. */
const EMPTY_CLASS_NAMES: MarkdownRendererClassNames = {};

/** Default react-markdown component overrides shared across all consumers. */
export const defaultMarkdownComponents: Components = {
  li: ({ children }) => <li className="mb-1.5 last:mb-0">{children}</li>,
};

/** Minimal shape shared by hast text and element nodes, enough to read a cell's plain text. */
interface HastTextLike {
  type: string;
  value?: string;
  children?: HastTextLike[];
}

/** Shape of a hast element node, enough to recognise KaTeX's display-math output. */
interface HastElementLike extends HastTextLike {
  tagName?: string;
  properties?: Record<string, unknown>;
}

/**
 * Recognises the markup `rehype-katex` emits for block math. With MathML output
 * KaTeX wraps both inline and display formulas in `<span class="katex">`; only
 * the `display="block"` attribute on the inner `<math>` tells them apart.
 */
const isDisplayMathElement = (node: HastElementLike | undefined): boolean => {
  const className = node?.properties?.className;

  if (!Array.isArray(className) || !className.includes('katex')) return false;

  const children = (node?.children ?? []) as HastElementLike[];

  return children.some(
    (child) =>
      child.type === 'element' &&
      child.tagName === 'math' &&
      child.properties?.display === 'block',
  );
};

/** Recursively concatenates the text content of a hast node. */
const getNodeText = (node: HastTextLike | undefined): string => {
  if (!node) return '';
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(getNodeText).join('');
};

/** Everything `buildMarkdownComponents` needs beyond the className overrides. */
interface MarkdownComponentOptions {
  isStreaming?: boolean;
  codeBlockCopyLabel?: string;
  codeBlockCopiedLabel?: string;
  codeBlockTheme?: CodeBlockTheme;
  tableScrollRegionAriaLabel?: string;
  mathScrollRegionAriaLabel?: string;
}

const buildMarkdownComponents = (
  cn: MarkdownRendererClassNames,
  {
    isStreaming,
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    codeBlockTheme,
    tableScrollRegionAriaLabel,
    mathScrollRegionAriaLabel,
  }: MarkdownComponentOptions,
): Components => ({
  h1: ({ children }) => <h1 className={cn.h1}>{children}</h1>,
  h2: ({ children }) => <h2 className={cn.h2}>{children}</h2>,
  h3: ({ children }) => <h3 className={cn.h3}>{children}</h3>,
  h4: ({ children }) => <h4 className={cn.h4}>{children}</h4>,
  h5: ({ children }) => <h5 className={cn.h5}>{children}</h5>,
  h6: ({ children }) => (
    <h6 className={mergeClasses(styles.h6, cn.h6)}>{children}</h6>
  ),
  /* `break-words` is structural rather than typographic: an unbreakable token
   * (typically a long URL) would otherwise overflow its container and get
   * clipped by any ancestor that hides overflow, e.g. a line-clamped quote. */
  p: ({ children }) => (
    <p className={mergeClasses('break-words', cn.p)}>{children}</p>
  ),
  ul: ({ children }) => (
    <ul className={mergeClasses('list-disc ps-5', cn.ul)}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className={mergeClasses('list-decimal ps-5', cn.ol)}>{children}</ol>
  ),
  strong: ({ children }) => (
    <strong className={cn.strong ?? 'dial-body-paragraph-semi-text'}>
      {children}
    </strong>
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
          styles.codeInline,
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
        'border-s-2 py-1 ps-4',
        styles.blockquote,
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
        'decoration-current/60 break-words underline underline-offset-2 hover:decoration-current focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2',
        styles.link,
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
  span: ({ children, node, ...props }) =>
    isDisplayMathElement(node) ? (
      <MarkdownMathBlock
        className={cn.mathBlock}
        scrollRegionAriaLabel={mathScrollRegionAriaLabel}
      >
        {children}
      </MarkdownMathBlock>
    ) : (
      <span {...props}>{children}</span>
    ),
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
        'sticky top-0 z-[2] max-w-96 whitespace-normal break-words px-3 py-2.5 text-start',
        tableStyles.rowDivider,
        tableStyles.tableHeaderCell,
        cn.tableHeaderFont ?? 'dial-tiny-lead-semi-text',
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
        'max-w-96 whitespace-normal px-3 py-2.5 align-top [overflow-wrap:anywhere]',
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
    rehypePlugins = EMPTY_REHYPE_PLUGINS,
    thinkingLabel = 'Thinking',
    codeBlockCopyLabel,
    codeBlockCopiedLabel,
    codeBlockTheme,
    colors,
    tableScrollRegionAriaLabel,
    mathScrollRegionAriaLabel,
  }) => {
    const displayedContent = useStreamedMarkdownContent(
      content,
      isStreaming,
      streamCharactersPerSecond,
    );
    const processedContent = useMemo(
      () => preprocessLaTeX(displayedContent),
      [displayedContent],
    );

    const cssVars = buildCssVars({
      '--cm-thinking-inverted': colors?.thinkingPrimary,
      '--cm-thinking-secondary': colors?.thinkingSecondary,
      '--cm-markdown-border': colors?.border,
      '--cm-blockquote-border': colors?.blockquoteBorder,
      '--cm-blockquote-text': colors?.blockquoteText,
      '--cm-link-text': colors?.linkText,
      '--cm-link-focus': colors?.linkFocus,
      '--cm-table-header-text': colors?.tableHeaderText,
      '--cm-h6-text': colors?.headingSixText,
      '--cm-code-inline-bg': colors?.inlineCodeBackground,
      '--cm-code-inline-text': colors?.inlineCodeText,
    });

    const mergedComponents = useMemo(
      () => ({
        ...buildMarkdownComponents(classNames, {
          isStreaming,
          codeBlockCopyLabel,
          codeBlockCopiedLabel,
          codeBlockTheme,
          tableScrollRegionAriaLabel,
          mathScrollRegionAriaLabel,
        }),
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
        mathScrollRegionAriaLabel,
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
          rehypePlugins={[...baseRehypePlugins, ...rehypePlugins]}
          components={mergedComponents}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  },
);
