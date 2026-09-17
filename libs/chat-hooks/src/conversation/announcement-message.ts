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

/** A link rendered as the call to action of an announcements-popover entry. */
export interface AnnouncementListItemLink {
  /** Visible text of the call to action. */
  label: string;
  /** Absolute `http`/`https` target the call to action opens. */
  href: string;
}

/** One entry of the announcements popover behind the banner's `+N` pill. */
export interface AnnouncementListItem {
  /** Plain-text heading of the entry. */
  title: string;
  /** Supporting copy of the entry, sanitized before it is rendered. */
  description?: string | null;
  /** Optional call to action shown at the end of the entry. */
  link?: AnnouncementListItemLink | null;
}

/** Structured announcement banner content. */
export interface AnnouncementContent {
  title: string | null;
  description: string | null;
  html: string | null;
  /** Entries of the popover the banner opens. */
  items?: readonly AnnouncementListItem[];
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

interface AnnouncementSignaturePayload {
  title: string;
  description: string;
  items?: {
    title: string;
    description: string;
    link: AnnouncementListItemLink | null;
  }[];
}

/*
 * Rebuilt field by field rather than stringified as received: the popover
 * entries arrive from a JSON-parsed environment variable, so their key order
 * follows however the operator typed them and would otherwise churn the
 * signature on a purely cosmetic edit.
 */
const buildItemsSignature = (
  items: readonly AnnouncementListItem[],
): NonNullable<AnnouncementSignaturePayload['items']> =>
  items.map((item) => ({
    title: item.title,
    description: item.description ?? '',
    link: item.link ? { label: item.link.label, href: item.link.href } : null,
  }));

/**
 * Builds the value persisted under `StorageKey.TextOfClosedAnnouncement` when
 * the user dismisses the banner. Dismissal is content-keyed: the banner stays
 * hidden only while the current announcement produces the same signature, so
 * editing any part of it brings the banner back with no version counter.
 *
 * Every piece of content the banner surface renders feeds the signature — the
 * title, the description, and the popover entries behind the pill, which live
 * inside the banner and are hidden along with it. Publishing a new entry in
 * that list therefore invalidates an earlier dismissal on its own, even when
 * the banner line itself is untouched.
 *
 * A legacy-only announcement returns the raw HTML string — byte-identical to
 * what shipped before the structured fields existed — so dismissals recorded
 * by older builds keep working without a storage migration. `items` is left
 * out of the payload entirely when the list is empty for the same reason: a
 * deployment that never configured the popover keeps matching the signatures
 * its users already have stored.
 */
export const buildAnnouncementSignature = (
  content: AnnouncementContent,
): string => {
  if (!hasStructuredAnnouncement(content)) {
    return content.html ?? '';
  }

  const payload: AnnouncementSignaturePayload = {
    title: content.title ?? '',
    description: content.description ?? '',
  };

  const items = content.items ?? [];
  if (items.length > 0) {
    payload.items = buildItemsSignature(items);
  }

  return JSON.stringify(payload);
};
