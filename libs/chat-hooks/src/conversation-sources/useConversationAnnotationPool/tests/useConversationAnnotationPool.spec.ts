import type { Conversation } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConversationAnnotationPool } from '../useConversationAnnotationPool';

const makeConversation = (
  customViewState?: Record<string, unknown>,
): Conversation =>
  ({
    id: 'bucket/gpt-4o__Hello__uuid',
    prompt: '',
    temperature: 1,
    messages: [],
    customViewState,
  }) as unknown as Conversation;

const makeHtmlTagAnnotation = (
  id: string,
  url = 'https://example.com/doc.pdf',
) => ({
  target: { selector: { type: 'html_tag', tag: 'cit', id } },
  body: {
    title: 'doc.pdf',
    source: {
      type: 'attachment',
      attachment: { type: 'application/pdf', url },
    },
  },
});

describe('useConversationAnnotationPool', () => {
  it('groups a well-formed pool into one group per id', () => {
    const conversation = makeConversation({
      annotations: [makeHtmlTagAnnotation('e1'), makeHtmlTagAnnotation('e2')],
    });
    const { result } = renderHook(() =>
      useConversationAnnotationPool(conversation),
    );

    expect(result.current).toHaveLength(2);
    expect(result.current.map((g) => g.groupKey)).toEqual(
      expect.arrayContaining(['cit:e1', 'cit:e2']),
    );
  });

  it('ignores a string entry, a null entry, and a selector-less entry without throwing', () => {
    const conversation = makeConversation({
      annotations: [
        'not-an-annotation',
        null,
        { target: { selector: { type: 'text_character_range' } } },
        makeHtmlTagAnnotation('e1'),
      ],
    });

    expect(() =>
      renderHook(() => useConversationAnnotationPool(conversation)),
    ).not.toThrow();

    const { result } = renderHook(() =>
      useConversationAnnotationPool(conversation),
    );
    expect(result.current).toHaveLength(1);
    expect(result.current[0].groupKey).toBe('cit:e1');
  });

  it('returns the shared empty array when customViewState is absent', () => {
    const conversation = makeConversation(undefined);
    const { result } = renderHook(() =>
      useConversationAnnotationPool(conversation),
    );

    expect(result.current).toEqual([]);
  });

  it('returns a reference-identical array across a re-render with unchanged input', () => {
    const conversation = makeConversation({
      annotations: [makeHtmlTagAnnotation('e1')],
    });
    const { result, rerender } = renderHook(
      (props: { conversation: Conversation }) =>
        useConversationAnnotationPool(props.conversation),
      { initialProps: { conversation } },
    );

    const first = result.current;
    rerender({ conversation });

    expect(result.current).toBe(first);
  });
});
