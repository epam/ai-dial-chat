import type { Annotation, PdfBBoxSelector } from '@epam/ai-dial-chat-shared';
import type { InputHighlightData } from '@epam/pdf-highlighter-kit';

/**
 * Maps a list of annotations to `InputHighlightData` entries for the PDF viewer.
 * Annotations whose `body.selector` contains no `pdf_bbox` selectors are skipped.
 * The highlight `id` is `annotation.index` when present, otherwise the position
 * in the input array.
 */
export const annotationsToPdfHighlights = (
  annotations: Annotation[],
): InputHighlightData[] =>
  annotations.flatMap((annotation, i) => {
    const selector = annotation.body?.selector;
    if (selector == null) return [];

    const selectors = Array.isArray(selector) ? selector : [selector];
    const bboxes = selectors.flatMap((s) => {
      if (s.type !== 'pdf_bbox') return [];
      const { page, x1, y1, x2, y2 } = s as PdfBBoxSelector;
      return [{ page, x1, y1, x2, y2 }];
    });

    if (bboxes.length === 0) return [];
    return [{ id: String(annotation.index ?? i), bboxes }];
  });

/**
 * Returns a stable string ID for a given annotation, matching the IDs produced
 * by `annotationsToPdfHighlights`.
 */
export const annotationHighlightId = (
  annotation: Annotation,
  fallbackIndex: number,
): string => String(annotation.index ?? fallbackIndex);
