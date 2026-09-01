/// <reference lib="dom" />

import DOMPurify from 'dompurify';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/** Minimal shape of the hast nodes {@link rehypeInlineStyles} walks. */
interface HastNode {
  /** Node kind — `'element'`, `'text'`, `'root'`. */
  type: string;
  /** Tag name, present on element nodes only. */
  tagName?: string;
  /** Serialized HTML attributes. */
  properties?: Record<string, unknown>;
  /** Child nodes. */
  children?: HastNode[];
}

/*
 * A paste target carries none of the app's CSS, so neither the classes the
 * markdown renderer uses nor the custom properties behind them survive the
 * clipboard — the styling has to travel inline, per element. The colors are the
 * light-theme fallbacks of the same tokens `MarkdownTable.module.scss` resolves
 * to on screen, so a pasted table keeps the border, header band, dividers, and
 * zebra rows it had in the conversation. Literal hex is deliberate here and is
 * the one place in this lib where it is correct: a custom property means
 * nothing once the markup leaves the app.
 *
 * One rule holds the set together: **a text color is only ever set together
 * with the background behind it.** A pasted document lands in someone else's
 * theme, and a lone `color` leaves dark text on whatever surface the target
 * paints — invisible in a dark-themed editor. So the table and the code block
 * carry a complete, opaque pair and read the same everywhere, while flowing
 * text (headings, paragraphs, lists, quotes, links) is given structure only —
 * size, weight, spacing, rules — and takes its color from the host document.
 */
const INLINE_STYLES: Record<string, string> = {
  table:
    'border-collapse:collapse;width:100%;margin:0 0 12px;font-size:14px;line-height:20px;background:#ffffff;color:#161b2d;border:1px solid #d1dbea',
  th: 'background:#fcfcfc;color:#57647a;border-bottom:1px solid #e0e6f0;padding:8px 12px;text-align:start;font-weight:600',
  td: 'border-top:1px solid #e0e6f0;padding:8px 12px;text-align:start',
  h1: 'font-size:20px;line-height:28px;font-weight:600;margin:0 0 12px',
  h2: 'font-size:18px;line-height:26px;font-weight:600;margin:16px 0 8px',
  h3: 'font-size:16px;line-height:24px;font-weight:600;margin:16px 0 8px',
  p: 'font-size:14px;line-height:24px;margin:0 0 12px',
  ul: 'font-size:14px;line-height:24px;margin:0 0 12px;padding-inline-start:24px',
  ol: 'font-size:14px;line-height:24px;margin:0 0 12px;padding-inline-start:24px',
  blockquote:
    'border-inline-start:3px solid #d1dbea;margin:0 0 12px;padding:4px 0 4px 12px',
  pre: 'background:#f8fafc;border:1px solid #d1dbea;border-radius:8px;padding:12px;overflow:auto;font-size:14px;line-height:20px;color:#161b2d;margin:0 0 12px',
  code: 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;background:#f3f5f9;color:#161b2d;padding:1px 4px;border-radius:4px',
  a: 'text-decoration:underline',
  hr: 'border:0;border-top:1px solid #d1dbea;margin:16px 0',
};

/** Background of every second body row, matching the rendered table's zebra rule. */
const ZEBRA_ROW_STYLE = 'background:#f5f7fa';

/** Inside a `<pre>` the box and its background are already drawn, so the inline-code chip is dropped. */
const CODE_IN_PRE_STYLE =
  'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px';

const appendStyle = (node: HastNode, style: string): void => {
  if (!node.properties) node.properties = {};
  const existing =
    typeof node.properties.style === 'string' ? node.properties.style : '';
  node.properties.style = existing ? `${existing};${style}` : style;
};

const styleNode = (node: HastNode, isInsidePre = false): void => {
  if (node.tagName === 'code' && isInsidePre) {
    appendStyle(node, CODE_IN_PRE_STYLE);
  } else if (node.tagName) {
    const style = INLINE_STYLES[node.tagName];
    if (style) appendStyle(node, style);
  }

  const children = node.children ?? [];

  /*
   * Zebra striping is a `:nth-child` rule on screen, which no inline style can
   * express — so the row's position in `<tbody>` decides it here.
   */
  if (node.tagName === 'tbody') {
    children
      .filter((child) => child.tagName === 'tr')
      .forEach((row, index) => {
        if (index % 2 === 1) appendStyle(row, ZEBRA_ROW_STYLE);
      });
  }

  children.forEach((child) =>
    styleNode(child, isInsidePre || node.tagName === 'pre'),
  );
};

/** Rehype plugin moving the rendered look of each element into its `style` attribute. */
const rehypeInlineStyles = () => (tree: HastNode) => styleNode(tree);

/**
 * Renders markdown to sanitized HTML whose styling travels inline, so a
 * rich-text target it is pasted into shows the tables, headings, and code
 * blocks the way the conversation does.
 */
export const markdownToRichTextHtml = (content: string): string =>
  DOMPurify.sanitize(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeInlineStyles)
      .use(rehypeStringify)
      .processSync(content)
      .toString(),
  );

/**
 * Copies markdown `content` to the clipboard as rich text, so pasting into a
 * rich-text target (Word, Gmail, Slack) keeps the formatting. Both the
 * `text/html` and the `text/plain` flavour are written, so a plain-text
 * target (Notepad, a terminal, a code editor) pastes the raw markdown instead
 * of nothing. Falls back to {@link copyToClipboard}, and therefore to the raw
 * markdown, when the multi-format Clipboard API isn't available.
 */
export const copyMarkdownAsRichText = (content: string): Promise<boolean> => {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === 'undefined'
  ) {
    return copyToClipboard(content);
  }

  let html: string;
  try {
    html = markdownToRichTextHtml(content);
  } catch {
    return copyToClipboard(content);
  }

  /*
   * Both flavours ride along. A rich target picks `text/html` — that is the
   * negotiation every editor implements, and the styling arrives as before —
   * while a plain-text target, which can read nothing but `text/plain`, would
   * otherwise paste an empty string. `onCopyMarkdown` still exists for the
   * deliberate markdown-only copy; this action is simply no longer unusable
   * outside a rich editor.
   *
   * Clipboard API must be called synchronously within the user-gesture
   * handler; do NOT await before calling it.
   */
  return navigator.clipboard
    .write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([content], { type: 'text/plain' }),
      }),
    ])
    .then(() => true)
    .catch(() => copyToClipboard(content));
};

/** Copies `text` to the clipboard; returns `true` on success, `false` when both the Clipboard API and the `execCommand` fallback fail. */
export const copyToClipboard = (text: string): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    /*
     * Clipboard API must be called synchronously within the user-gesture
     * handler; do NOT await before calling it.
     */
    return navigator.clipboard
      .writeText(text)
      .then(() => true)
      .catch(() => execCommandFallback(text));
  }
  return Promise.resolve(execCommandFallback(text));
};

const execCommandFallback = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.innerText = text;
  // Keep it out of the viewport and non-interactive.
  textarea.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;';
  /*
   * iOS Safari requires the element NOT to be readonly for setSelectionRange
   * to work, but we prevent the keyboard from appearing with this trick.
   */
  textarea.setAttribute('autocomplete', 'off');
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    // `textarea.select()` is ignored on iOS Safari — use setSelectionRange.
    textarea.removeAttribute('readonly');
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
};
