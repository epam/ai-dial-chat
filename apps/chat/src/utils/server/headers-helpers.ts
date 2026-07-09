'use server';
export const cleanHeaderDirectives = (directives: string) =>
  directives.replace(/\s{2,}/g, ' ').trim();

const insertSelf = (str: string) => `'self' ${str.replaceAll("'self'", '')}`;
/**
 *
 * @param frameAncestors sources for the 'frame-ancestors' directive from the 'process.env.ALLOWED_IFRAME_ORIGINS'
 * @param frameSrc sources for the 'frame-src' directive from the 'process.env.ALLOWED_IFRAME_SOURCES'
 * @param disabled if 'true' will set 'none' for both directives
 * @returns
 */
export const getFrameContentSecurityPolicyDirectives = (disabled = false) => {
  const frameAncestors = process.env.ALLOWED_IFRAME_ORIGINS;
  const frameSrc = process.env.ALLOWED_IFRAME_SOURCES;
  const scriptSrc = process.env.ALLOWED_SCRIPT_SOURCES;
  const imageSources = process.env.ALLOWED_IMAGE_SOURCES;
  const themesConfigHost = process.env.THEMES_CONFIG_HOST;
  const isDev = process.env.NODE_ENV === 'development';
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const allowedScriptsSrc = insertSelf(
    scriptSrc ?? `${frameAncestors ?? ''} ${frameSrc ?? ''}`,
  );
  const ancestorsDirective =
    frameAncestors && !disabled ? insertSelf(frameAncestors) : "'none'";

  const frameSrcDirective =
    frameSrc && !disabled ? insertSelf(frameSrc) : "'none'";

  //'wasm-unsafe-eval' is needed to allow wasm-code to be executed for the tiktoken library
  return [
    `
    object-src 'none';
    base-uri 'self';
    script-src ${allowedScriptsSrc} https://cdn.jsdelivr.net/npm/monaco-editor@0.54.0/ 'nonce-${nonce}' ${isDev ? "'unsafe-eval'" : ''} 'wasm-unsafe-eval';
    worker-src 'self' blob:;
    img-src 'self' data: blob: ${themesConfigHost ?? ''} ${imageSources ?? ''};
    form-action 'self';
    frame-ancestors ${ancestorsDirective};
    frame-src ${frameSrcDirective};
`,
    nonce,
  ];
};
