import type { Annotation } from '@epam/ai-dial-chat-shared';

/** A set of annotations that all cite the same source document. */
export interface AnnotationGroup {
  /** The attachment URL shared by all annotations in this group. */
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

/** Groups annotations by their source attachment URL. Annotations without a `body.source.attachment.url` are excluded. */
export const groupAnnotationsBySource = (
  annotations: Annotation[],
): AnnotationGroup[] => {
  const map = new Map<string, AnnotationGroup>();

  for (const annotation of annotations) {
    const url = annotation.body?.source?.attachment?.url;
    if (url == null) continue;

    const existing = map.get(url);
    if (existing) {
      existing.annotations.push(annotation);
    } else {
      map.set(url, {
        sourceUrl: url,
        sourceName:
          annotation.body?.source?.attachment?.title ?? deriveSourceName(url),
        annotations: [annotation],
        primaryAnnotation: annotation,
      });
    }
  }

  return Array.from(map.values());
};
