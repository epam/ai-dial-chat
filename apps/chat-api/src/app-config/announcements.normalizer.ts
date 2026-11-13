import type {
  AnnouncementItemDto,
  AnnouncementLinkDto,
} from './dto/announcement-item.dto';
import { AnnouncementSeverity } from './dto/announcement-severity.enum';
import { sanitizeAnnouncementHtml } from './html-sanitizer';
import { toNullableText } from './text.util';

const MAX_ANNOUNCEMENTS = 10;

/* Parsed rather than prefix-matched, so "JaVaScRiPt:" and whitespace-padded
 * schemes are caught too. Relative URLs are rejected on purpose: operator
 * config must not be able to point at an in-app route. */
const isExternalHttpUrl = (href: string): boolean => {
  try {
    const { protocol } = new URL(href);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

type AnnouncementRejection = { reason: string };

const parseAnnouncementLink = (
  raw: unknown,
): AnnouncementLinkDto | null | AnnouncementRejection => {
  /* No link at all is valid — an announcement may be purely informational. */
  if (raw == null) {
    return null;
  }
  if (typeof raw !== 'object') {
    return { reason: 'link is not an object' };
  }

  const { label, href } = raw as Record<string, unknown>;
  const parsedLabel = toNullableText(label);
  if (!parsedLabel) {
    return { reason: 'link.label is blank or missing' };
  }
  if (typeof href !== 'string' || !isExternalHttpUrl(href.trim())) {
    return { reason: `link.href is not an http(s) URL: ${String(href)}` };
  }

  return { label: parsedLabel, href: href.trim() };
};

const ANNOUNCEMENT_SEVERITIES: ReadonlySet<string> = new Set(
  Object.values(AnnouncementSeverity),
);

const isAnnouncementSeverity = (value: string): value is AnnouncementSeverity =>
  ANNOUNCEMENT_SEVERITIES.has(value);

/* Severity is presentation metadata, so an unrecognized value is reported to
 * the caller rather than rejecting the entry: a typo must never hide an
 * announcement. Case and surrounding whitespace are forgiven because operators
 * hand-write this in Helm values; the result is always the canonical value. */
const parseAnnouncementSeverity = (
  raw: unknown,
): AnnouncementSeverity | AnnouncementRejection => {
  if (raw == null) {
    return AnnouncementSeverity.Info;
  }
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (isAnnouncementSeverity(normalized)) {
      return normalized;
    }
  }
  return { reason: `unknown severity ${JSON.stringify(raw)}` };
};

/**
 * Normalizes the operator-authored announcements list. Bad entries are
 * dropped with a warning rather than throwing: a typo in a Helm values file
 * must never take down `/api/v1/client-config`. The one exception is an
 * unrecognized `severity`: the entry is kept as `info` and the value is
 * logged, so a typo never hides an announcement.
 *
 * Takes a `warn` callback rather than a logger, following the
 * `normalizeEnabledUiFeatures` pattern in `enabled-ui-features.normalizer.ts`:
 * this module has no `@nestjs/common` dependency and constructs nothing, so
 * `AppConfigService` passes `(message) => this.logger.warn(message)` to keep
 * every warning under its own `Logger` context.
 */
export const normalizeAnnouncements = (
  value: unknown,
  warn: (message: string) => void,
): AnnouncementItemDto[] => {
  if (!Array.isArray(value)) {
    if (value != null) {
      warn('ANNOUNCEMENTS did not resolve to an array; ignoring it');
    }
    return [];
  }

  const items: AnnouncementItemDto[] = [];

  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') {
      warn('Ignoring announcement entry that is not an object');
      continue;
    }

    const { title, description, link, severity } = entry as Record<
      string,
      unknown
    >;

    const parsedTitle = toNullableText(title);
    if (!parsedTitle) {
      warn('Ignoring announcement entry with a blank or missing title');
      continue;
    }

    const parsedLink = parseAnnouncementLink(link);
    if (parsedLink && 'reason' in parsedLink) {
      /* Dropping the whole entry, not just the link: a row that still looks
       * right but silently lost its call to action is worse than a missing
       * row, because nobody notices it. */
      warn(`Ignoring announcement "${parsedTitle}": ${parsedLink.reason}`);
      continue;
    }

    /* Evaluated only once the entry is known to survive, so a dropped entry
     * never logs a second, severity-specific warning. */
    const parsedSeverity = parseAnnouncementSeverity(severity);
    let resolvedSeverity = AnnouncementSeverity.Info;
    if (typeof parsedSeverity === 'object') {
      warn(
        `Announcement "${parsedTitle}": ${parsedSeverity.reason}; using "${AnnouncementSeverity.Info}"`,
      );
    } else {
      resolvedSeverity = parsedSeverity;
    }

    const rawDescription = toNullableText(description);

    items.push({
      title: parsedTitle,
      description: rawDescription
        ? sanitizeAnnouncementHtml(rawDescription)
        : null,
      link: parsedLink,
      severity: resolvedSeverity,
    });
  }

  if (items.length > MAX_ANNOUNCEMENTS) {
    warn(
      `ANNOUNCEMENTS carried ${items.length} entries; keeping the first ${MAX_ANNOUNCEMENTS} and dropping the rest`,
    );
    return items.slice(0, MAX_ANNOUNCEMENTS);
  }

  return items;
};
