import sanitizeHtml from 'sanitize-html';

/* Anchors that leave the page are forced to open in a new tab with the
 * opener severed. Hash links stay in-page, so they keep their attributes. */
const externalizeAnchors: sanitizeHtml.IOptions['transformTags'] = {
  a: (tagName, attribs) => {
    const href = attribs.href ?? '';
    if (href.startsWith('#')) {
      return { tagName, attribs };
    }
    return {
      tagName,
      attribs: {
        ...attribs,
        target: '_blank',
        rel: 'noopener noreferrer',
      },
    };
  },
};

const ANCHOR_ATTRS: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel'],
};

const FOOTER_ALLOWED_TAGS = ['a', 'span', 'strong', 'u', 'em', 'br', 'p'];

/* Deliberately narrower than the footer's list and kept in lockstep with the
 * client-side DOMPurify pass in AnnouncementBanner: the banner is a single
 * truncating line, so block-level and underline markup have no place in it.
 * Widening one side without the other means the client silently strips what
 * the server allowed. */
const ANNOUNCEMENT_ALLOWED_TAGS = ['a', 'b', 'strong', 'em', 'br', 'span'];

/**
 * Sanitizes an operator-authored footer message and substitutes the
 * `%%VERSION%%` token with the resolved application version.
 */
export const sanitizeFooterHtml = (raw: string, version: string): string =>
  sanitizeHtml(raw.replace(/%%VERSION%%/g, version), {
    allowedTags: FOOTER_ALLOWED_TAGS,
    allowedAttributes: ANCHOR_ATTRS,
    transformTags: externalizeAnchors,
  });

/**
 * Sanitizes the operator-authored announcement description. Returns `null`
 * when the input is blank or when sanitization removes everything, so callers
 * never have to distinguish "unset" from "sanitized away".
 */
export const sanitizeAnnouncementHtml = (raw: string): string | null => {
  const sanitized = sanitizeHtml(raw, {
    allowedTags: ANNOUNCEMENT_ALLOWED_TAGS,
    allowedAttributes: ANCHOR_ATTRS,
    transformTags: externalizeAnchors,
  }).trim();

  return sanitized.length > 0 ? sanitized : null;
};
