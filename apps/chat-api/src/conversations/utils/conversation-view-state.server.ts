import { AnnotationDto as Annotation } from '../dto/annotation.dto';

/**
 * Returns the pool identity for a qualifying `html_tag` citation annotation
 * — one whose selector carries an `id` and whose body resolves to an
 * attachment `url` — or `null` for any other annotation (offset-based
 * selectors, or a malformed/partial entry from untrusted persisted JSON).
 */
const qualifyingAnnotationId = (
  annotation: Annotation | null | undefined,
): string | null => {
  if (annotation == null) return null;
  const selector = annotation.target?.selector;
  if (selector?.type !== 'html_tag' || selector.id == null) return null;
  return annotation.body?.source?.attachment?.url != null ? selector.id : null;
};

/**
 * Merges the terminal assistant message's `html_tag` citation annotations
 * into `customViewState.annotations`, deduplicated by selector `id` (first
 * entry wins), preserving every other key of `current` verbatim. Returns
 * `current` unchanged when nothing new qualifies, so an empty pool is never
 * written for a conversation that had none.
 */
export const mergeHtmlTagAnnotationsIntoViewState = (
  current: Record<string, unknown> | undefined,
  annotations: Annotation[] | undefined,
): Record<string, unknown> | undefined => {
  const existingPool = Array.isArray(current?.['annotations'])
    ? (current['annotations'] as unknown[])
    : [];
  const knownIds = new Set(
    existingPool
      .map((entry) => qualifyingAnnotationId(entry as Annotation))
      .filter((id): id is string => id != null),
  );

  const additions: Annotation[] = [];
  for (const annotation of annotations ?? []) {
    const id = qualifyingAnnotationId(annotation);
    if (id == null || knownIds.has(id)) continue;
    knownIds.add(id);
    additions.push(annotation);
  }

  if (additions.length === 0) return current;

  return {
    ...current,
    annotations: [...existingPool, ...additions],
  };
};
