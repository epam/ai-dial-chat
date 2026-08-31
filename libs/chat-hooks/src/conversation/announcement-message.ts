import DOMPurify, { type Config } from 'dompurify';

/*
 * Kept in lockstep with ANNOUNCEMENT_ALLOWED_TAGS in
 * apps/chat-api/src/app-config/html-sanitizer.ts. Widening one side without
 * the other means the server returns markup this pass silently strips.
 *
 * Inline-only by design: the structured banner renders the description as a
 * single truncating line, so block-level markup has nowhere to go.
 */
const ANNOUNCEMENT_HTML_SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: ['a', 'b', 'strong', 'em', 'br', 'span'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

/*
 * The legacy ANNOUNCEMENT_HTML_MESSAGE banner is a free-standing block rather
 * than a truncated line, so it additionally accepts `p` — operators routinely
 * author multi-paragraph announcements — and `u`. `style` stays out on
 * purpose: the banner underlines its own links, and letting operator CSS
 * through would put arbitrary positioning inside app chrome.
 *
 * This field is sanitized on the client only. The backend passes it through
 * verbatim so that `buildAnnouncementSignature` keeps producing the byte-for-byte
 * value older builds stored for dismissal.
 */
const ANNOUNCEMENT_MESSAGE_SANITIZE_OPTIONS: Config = {
  ALLOWED_TAGS: ['a', 'b', 'strong', 'em', 'u', 'br', 'span', 'p'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

/** Structured announcement banner content. */
export interface AnnouncementContent {
  title: string | null;
  description: string | null;
  html: string | null;
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Sanitizes announcement HTML to the allowed inline tag/attribute set. */
export const sanitizeAnnouncementHtml = (html: string): string =>
  DOMPurify.sanitize(html, ANNOUNCEMENT_HTML_SANITIZE_OPTIONS) as string;

/**
 * Sanitizes the legacy `ANNOUNCEMENT_HTML_MESSAGE` banner, which permits the
 * block-level markup the inline pass strips. See
 * `ANNOUNCEMENT_MESSAGE_SANITIZE_OPTIONS` for why the two lists differ.
 */
export const sanitizeAnnouncementMessageHtml = (html: string): string =>
  DOMPurify.sanitize(html, ANNOUNCEMENT_MESSAGE_SANITIZE_OPTIONS) as string;

const isNonEmpty = (value: string | null): value is string =>
  typeof value === 'string' && value.length > 0;

/**
 * Whether the operator configured the structured banner (title and/or
 * description) rather than only the legacy HTML message. Drives which of the
 * two banner layouts renders.
 */
export const hasStructuredAnnouncement = ({
  title,
  description,
}: AnnouncementContent): boolean =>
  isNonEmpty(title) || isNonEmpty(description);

/** True when the announcement has any renderable content (structured or legacy HTML). */
export const hasAnnouncementContent = (content: AnnouncementContent): boolean =>
  hasStructuredAnnouncement(content) || isNonEmpty(content.html);

/**
 * Builds the value persisted under `StorageKey.TextOfClosedAnnouncement` when
 * the user dismisses the banner. Dismissal is content-keyed: the banner stays
 * hidden only while the current announcement produces the same signature, so
 * editing any part of it brings the banner back with no version counter.
 *
 * A legacy-only announcement returns the raw HTML string — byte-identical to
 * what shipped before the structured fields existed — so dismissals recorded
 * by older builds keep working without a storage migration.
 */
export const buildAnnouncementSignature = (
  content: AnnouncementContent,
): string => {
  if (!hasStructuredAnnouncement(content)) {
    return content.html ?? '';
  }

  return JSON.stringify({
    title: content.title ?? '',
    description: content.description ?? '',
  });
};
