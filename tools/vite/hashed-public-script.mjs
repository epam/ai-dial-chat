import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Returns `html` with the `src` of the script that loads `publicPath` pointed at `fileName`; throws when no such script exists. */
export const rewritePublicScriptSrc = (html, publicPath, fileName) => {
  const from = `src="/${publicPath}"`;
  if (!html.includes(from)) {
    throw new Error(
      `dial-hashed-public-script: index.html has no <script ${from}>`,
    );
  }
  return html.replace(from, `src="/${fileName}"`);
};

/**
 * Build-only: serves a classic script from `public/` through a content-hashed
 * copy under the assets directory, which chat-api caches as `immutable`.
 *
 * A file in `public/` keeps its name, so a host can only revalidate it, and a
 * synchronous head script then costs a blocking round trip on every warm load.
 * Inlining it instead would need `script-src` to allow inline scripts, which
 * the app-shell CSP deliberately does not. The dev server keeps serving the
 * `public/` file unchanged.
 */
export const hashedPublicScriptPlugin = (publicPath) => {
  let sourcePath;
  let assetsDir;
  let fileName;

  return {
    name: 'dial-hashed-public-script',
    apply: 'build',
    configResolved(config) {
      sourcePath = join(config.publicDir, publicPath);
      assetsDir = config.build.assetsDir;
    },
    buildStart() {
      const source = readFileSync(sourcePath, 'utf8');
      const hash = createHash('sha256')
        .update(source)
        .digest('base64url')
        .slice(0, 8);
      fileName = `${assetsDir}/${publicPath.replace(/\.js$/, '')}-${hash}.js`;
      this.emitFile({ type: 'asset', fileName, source });
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) => rewritePublicScriptSrc(html, publicPath, fileName),
    },
  };
};
