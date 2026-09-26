import type { Annotation, Conversation } from '@epam/ai-dial-chat-shared';
import {
  groupAnnotationsByCitId,
  type AnnotationGroup,
} from '@epam/ai-dial-quotations';
import { useMemo } from 'react';

/*
 * Shared empty array so an absent or empty pool never produces a fresh `[]`
 * per render — a new identity would invalidate ConversationMessageItem's
 * memo and force MarkdownRenderer to re-parse every assistant message.
 */
const EMPTY_POOL: AnnotationGroup[] = [];

const isHtmlTagAnnotation = (value: unknown): value is Annotation => {
  if (value == null || typeof value !== 'object') return false;
  const target = (value as Annotation).target;
  return target?.selector?.type === 'html_tag';
};

/**
 * Derives the conversation-level fallback citation pool from
 * `conversation.customViewState.annotations`, resolving a `<cit data-id="…">`
 * element whose annotation arrived in an earlier turn (issue #9002) and is
 * therefore absent from the current message's own citation groups.
 *
 * The field is untrusted persisted JSON — absent on most conversations,
 * writable by conversation import — so this hook treats a non-array, a
 * `null` entry, and an entry without an `html_tag` selector as absent
 * rather than throwing.
 */
export const useConversationAnnotationPool = (
  conversation: Conversation,
): AnnotationGroup[] => {
  const customViewState = conversation.customViewState;

  return useMemo(() => {
    const rawAnnotations = customViewState?.['annotations'];
    if (!Array.isArray(rawAnnotations)) return EMPTY_POOL;

    const annotations = rawAnnotations.filter(isHtmlTagAnnotation);
    if (annotations.length === 0) return EMPTY_POOL;

    return groupAnnotationsByCitId(annotations);
  }, [customViewState]);
};
