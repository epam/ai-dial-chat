import type { MarkdownRendererClassNames } from './MarkdownRenderer';

/** Default typography classNames for rendering markdown with full visual hierarchy. */
export const DEFAULT_MARKDOWN_CLASS_NAMES: MarkdownRendererClassNames = {
  h1: 'dial-h1-text mb-3 mt-6 first:mt-0 [text-wrap:balance]',
  h2: 'dial-h2-text mb-2 mt-5 first:mt-0 [text-wrap:balance]',
  h3: 'dial-h3-text mb-2 mt-4 first:mt-0 [text-wrap:balance]',
  h4: 'mb-2 mt-4 dial-body-semi-text first:mt-0 [text-wrap:balance]',
  h5: 'mb-2 mt-4 dial-small-semi-text first:mt-0 [text-wrap:balance]',
  h6: 'mb-2 mt-4 text-sm font-medium text-secondary first:mt-0 [text-wrap:balance]',
  p: 'dial-body-paragraph-text mb-3 break-words [overflow-wrap:anywhere] [text-wrap:pretty] last:mb-0',
  ul: 'mb-3 space-y-1',
  ol: 'mb-3 space-y-1',
  codeInline:
    'mx-0.5 bg-layer-raised px-1.5 text-[0.875em] text-primary break-words [overflow-wrap:anywhere]',
  blockquote: 'my-4',
  link: 'break-words [overflow-wrap:anywhere]',
  tableWrapper: 'my-4',
};
