'use server';
export const cleanHeaderDirectives = (directives: string) =>
  directives.replace(/\s{2,}/g, ' ').trim();

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
  const isDev = process.env.NODE_ENV === 'development';
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const allowedScriptsSrc = `${frameAncestors ?? ''} ${frameSrc ?? ''}`.replace(
    "'self'",
    '',
  );
  const ancestorsDirective =
    frameAncestors && !disabled
      ? `frame-ancestors 'self' ${frameAncestors.replace("'self'", '')}`
      : "frame-ancestors 'none'";

  const frameSrcDirective =
    frameSrc && !disabled
      ? `frame-src 'self' ${frameSrc.replace("'self'", '')}`
      : "frame-src 'none'";

  return [
    `
    object-src 'none';
    base-uri 'self';
    script-src 'self' ${allowedScriptsSrc}
     https://cdn.jsdelivr.net/npm/monaco-editor@0.54.0/
     'nonce-${nonce}' 'wasm-unsafe-eval' ${isDev ? "'unsafe-eval'" : ''};
     worker-src 'self' blob:;
    ${ancestorsDirective};
    ${frameSrcDirective};
`,
    nonce,
  ];
};
