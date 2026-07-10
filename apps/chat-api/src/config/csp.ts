export const buildFrameSrcDirective = (
  allowedIframeOrigins: string[],
): string[] => ["'self'", ...allowedIframeOrigins];
