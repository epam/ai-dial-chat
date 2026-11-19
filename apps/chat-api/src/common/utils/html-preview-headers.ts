import type { Response } from 'express';
import { createHtmlPreviewCspHeader } from '../../config/csp';

/** Returns whether a download's `content-type` is an HTML document. */
export const isHtmlContentType = (contentType: string | undefined): boolean =>
  contentType?.toLowerCase().startsWith('text/html') ?? false;

/**
 * Makes an HTML download, whose headers are already set on `res`, render in
 * the attachment-preview iframe (`src=`) instead of downloading: sets the
 * sandboxed preview CSP and turns an `attachment` disposition into `inline`.
 */
export const applyHtmlPreviewHeaders = (
  res: Response,
  allowedIframeOrigins: string[],
): void => {
  /*
   * The `sandbox` directive of this policy forces the response to render at
   * an opaque origin however it is loaded (preview iframe, new tab, direct
   * link), so rendering it inline never runs its scripts on the chat origin.
   */
  res.setHeader(
    'Content-Security-Policy',
    createHtmlPreviewCspHeader(allowedIframeOrigins),
  );
  /* Never leave a stale report-only policy beside the enforced one above. */
  res.removeHeader('Content-Security-Policy-Report-Only');

  /*
   * A sandboxed iframe without `allow-downloads` refuses an `attachment`
   * response and never fires `load`. An explicit "download to disk" goes
   * through a same-origin `<a download>`, which ignores this header.
   */
  const disposition = res.getHeader('Content-Disposition');
  if (typeof disposition === 'string') {
    res.setHeader(
      'Content-Disposition',
      disposition.replace(/^attachment/i, 'inline'),
    );
  }
};
