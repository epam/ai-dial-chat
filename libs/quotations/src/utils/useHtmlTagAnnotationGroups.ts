import type { Annotation } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import {
  groupAnnotationsByCitId,
  type AnnotationGroup,
} from './group-annotations-by-source';

/*
 * Shared empty array so an absent or empty pool never produces a fresh `[]`
 * per render — a new identity would invalidate ConversationMessageItem's
 * memo and force MarkdownRenderer to re-parse every assistant message.
 */
const EMPTY_POOL: AnnotationGroup[] = [];

const isHtmlTagAnnotation = (value: unknown): value is Annotation => {
  if (value == null || typeof value !== 'object') return false;
  const target = (value as Annotation).target;
  const selector = target?.selector;
  const attachment = (value as Annotation).body?.source?.attachment;
  return (
    selector?.type === 'html_tag' &&
    typeof selector.id === 'string' &&
    typeof attachment?.url === 'string' &&
    (attachment.title == null || typeof attachment.title === 'string')
  );
};

/** Groups valid html-tag annotations without knowing the host persistence schema. */
export const useHtmlTagAnnotationGroups = (
  rawAnnotations: unknown,
): AnnotationGroup[] =>
  useMemo(() => {
    if (!Array.isArray(rawAnnotations)) return EMPTY_POOL;
    const groups = groupAnnotationsByCitId(
      rawAnnotations.filter(isHtmlTagAnnotation),
    );
    return groups.length ? groups : EMPTY_POOL;
  }, [rawAnnotations]);
