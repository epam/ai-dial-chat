import type { Annotation, HtmlTagSelector } from '@epam/ai-dial-chat-shared';

/** A set of annotations rendered behind one inline citation marker. */
export interface AnnotationGroup {
  /**
   * This group's identity — used for open/active-index popup state and
   * React keys. Equals `sourceUrl` for a `groupAnnotationsBySource` group;
   * equals `` `cit:${id}` `` for a `groupAnnotationsByCitId` group, so two
   * cit ids citing the same document never share popup state.
   */
  groupKey: string;
  /** The cited attachment's URL — used for Preview/Download. */
  sourceUrl: string;
  /**
   * Human-readable name derived from the URL: the last non-empty path segment
   * (decoded, without query params) when available, otherwise the URL hostname.
   */
  sourceName: string;
  /** Every annotation in this group, in their original order. */
  annotations: Annotation[];
  /** The first annotation in the group — used for the inline citation marker position. */
  primaryAnnotation: Annotation;
}

const safeDecodeURI = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

const deriveSourceName = (url: string): string => {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .split('/')
      .map((s) => safeDecodeURI(s))
      .filter(Boolean);
    return segments.at(-1) ?? parsed.hostname;
  } catch {
    const segments = url
      .split('/')
      .map((s) => safeDecodeURI(s))
      .filter(Boolean);
    return segments.at(-1) ?? url;
  }
};

/** Resolves a group's display name: the attachment title when present, otherwise a name derived from its URL. */
const resolveSourceName = (annotation: Annotation, url: string): string =>
  annotation.body?.source?.attachment?.title ?? deriveSourceName(url);

/**
 * Returns the annotation's `html_tag` selector, or `undefined` when its
 * selector is a different type. Narrowed via an explicit cast rather than
 * control-flow narrowing, because `AnnotationSelector`'s open catch-all
 * variant (`{ type: string; [key: string]: unknown }`) also satisfies
 * `type === 'html_tag'` and would otherwise widen `.id` to `unknown`.
 */
const getHtmlTagSelector = (
  annotation: Annotation,
): HtmlTagSelector | undefined => {
  const selector = annotation.target?.selector;
  return selector?.type === 'html_tag'
    ? (selector as HtmlTagSelector)
    : undefined;
};

const isHtmlTagAnnotation = (annotation: Annotation): boolean =>
  getHtmlTagSelector(annotation) != null;

/**
 * Groups annotations by their source attachment URL. Annotations without a
 * `body.source.attachment.url` are excluded, as are `html_tag`-selector
 * annotations — those are grouped by tag id instead, see
 * `groupAnnotationsByCitId`.
 */
export const groupAnnotationsBySource = (
  annotations: Annotation[],
): AnnotationGroup[] => {
  const map = new Map<string, AnnotationGroup>();

  for (const annotation of annotations) {
    if (isHtmlTagAnnotation(annotation)) continue;
    const url = annotation.body?.source?.attachment?.url;
    if (url == null) continue;

    const existing = map.get(url);
    if (existing) {
      existing.annotations.push(annotation);
    } else {
      map.set(url, {
        groupKey: url,
        sourceUrl: url,
        sourceName: resolveSourceName(annotation, url),
        annotations: [annotation],
        primaryAnnotation: annotation,
      });
    }
  }

  return Array.from(map.values());
};

/**
 * Groups `html_tag`-selector annotations by `target.selector.id`, one group
 * per distinct tag id — never collapsing two different ids that cite the
 * same source document into one group. Annotations without
 * `target.selector.id` or without `body.source.attachment.url` are excluded.
 */
export const groupAnnotationsByCitId = (
  annotations: Annotation[],
): AnnotationGroup[] => {
  const map = new Map<string, AnnotationGroup>();

  for (const annotation of annotations) {
    const id = getHtmlTagSelector(annotation)?.id;
    if (id == null) continue;
    const url = annotation.body?.source?.attachment?.url;
    if (url == null) continue;

    const existing = map.get(id);
    if (existing) {
      existing.annotations.push(annotation);
    } else {
      map.set(id, {
        groupKey: `cit:${id}`,
        sourceUrl: url,
        sourceName: resolveSourceName(annotation, url),
        annotations: [annotation],
        primaryAnnotation: annotation,
      });
    }
  }

  return Array.from(map.values());
};

/**
 * Partitions annotations by selector type and groups each family with its
 * own algorithm: `html_tag` annotations via `groupAnnotationsByCitId`, every
 * other annotation via `groupAnnotationsBySource`. Lets a host render
 * citations without branching on selector type itself.
 */
export const groupAnnotations = (annotations: Annotation[]): AnnotationGroup[] => [
  ...groupAnnotationsByCitId(annotations),
  ...groupAnnotationsBySource(annotations),
];
