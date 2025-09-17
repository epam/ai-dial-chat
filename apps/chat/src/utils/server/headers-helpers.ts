export const cleanHeaderDirectives = (directives: string) =>
  directives.replace(/\s{2,}/g, ' ').trim();
/**
 *
 * @param frameAncestors sources for the 'frame-ancestors' directive from the 'process.env.ALLOWED_IFRAME_ORIGINS'
 * @param frameSrc sources for the 'frame-src' directive from the 'process.env.ALLOWED_IFRAME_SOURCES'
 * @param disabled if 'true' will set 'none' for both directives
 * @returns
 */
export const getFrameContentSecurityPolicyDirectives = (
  frameAncestors: string | undefined,
  frameSrc: string | undefined,
  disabled?: boolean,
) => {
  const ancestorsDirective =
    frameAncestors && !disabled
      ? 'frame-ancestors ' + frameAncestors
      : "frame-ancestors 'none'";

  const frameSrcDirective =
    frameSrc && !disabled ? 'frame-src ' + frameSrc : "frame-src 'none'";

  return `${ancestorsDirective}; ${frameSrcDirective};`;
};
