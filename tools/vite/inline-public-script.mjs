import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LEADING_BLOCK_COMMENT = /^\s*\/\*[\s\S]*?\*\/\s*/;

/**
 * Returns `html` with `<script src="/<publicPath>"></script>` replaced by an
 * inline script holding `source` without its leading block comment; throws
 * when no such script exists or the source would close the script element.
 */
export const inlinePublicScript = (html, publicPath, source) => {
  const from = `<script src="/${publicPath}"></script>`;
  if (!html.includes(from)) {
    throw new Error(`dial-inline-public-script: index.html has no ${from}`);
  }
  const body = source.replace(LEADING_BLOCK_COMMENT, '').trim();
  if (/<\/script/i.test(body)) {
    throw new Error(
      `dial-inline-public-script: ${publicPath} contains "</script"`,
    );
  }
  /* A replacer function: a string replacement would expand `$&`, `` $` ``
   * and `$'` sequences that the script source may contain. */
  return html.replace(from, () => `<script>${body}</script>`);
};

/**
 * Build-only: inlines a classic script from `public/` into `index.html`.
 *
 * A synchronous head script costs first paint a blocking request on every
 * cold load. Inline, it runs as the parser reaches it. chat-api allows exactly
 * this script by its SHA-256 hash, which it computes from the built
 * `index.html` (`collectInlineScriptHashes` in
 * `apps/chat-api/src/app/static-assets.ts`), so the app-shell CSP still
 * allows no other inline script. The dev server keeps serving the `public/`
 * file unchanged.
 */
export const inlinePublicScriptPlugin = (publicPath) => {
  let sourcePath;

  return {
    name: 'dial-inline-public-script',
    apply: 'build',
    configResolved(config) {
      sourcePath = join(config.publicDir, publicPath);
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        inlinePublicScript(html, publicPath, readFileSync(sourcePath, 'utf8')),
    },
  };
};
