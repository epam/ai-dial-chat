import type { Annotation, Message } from '@epam/ai-dial-chat-shared';
import { MessageRole } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAnnotations } from '../useAnnotations';

const baseMessage = (): Message => ({
  role: MessageRole.Assistant,
  content: 'Hello',
  timestamp: new Date().toISOString(),
});

const withAnnotation = (msg: Message, annotation: Annotation): Message => ({
  ...msg,
  custom_content: {
    ...msg.custom_content,
    annotations: [...(msg.custom_content?.annotations ?? []), annotation],
  },
});

const validAnnotation: Annotation = {
  index: 0,
  body: {
    source: {
      type: 'attachment',
      attachment: { type: 'application/pdf', url: 'files/report.pdf' },
    },
  },
};

describe('useAnnotations', () => {
  it('returns annotations directly for a completed message', () => {
    const msg = withAnnotation(baseMessage(), validAnnotation);
    const { result } = renderHook(() => useAnnotations(msg, false));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toBe(validAnnotation);
  });

  it('returns an empty array while streaming', () => {
    const msg = withAnnotation(baseMessage(), validAnnotation);
    const { result } = renderHook(() => useAnnotations(msg, true));
    expect(result.current).toHaveLength(0);
  });

  it('filters out annotations without a source URL', () => {
    const noSource: Annotation = { index: 1, body: { title: 'no source' } };
    const msg: Message = {
      ...baseMessage(),
      custom_content: { annotations: [validAnnotation, noSource] },
    };
    const { result } = renderHook(() => useAnnotations(msg, false));
    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toBe(validAnnotation);
  });

  it('skips null/undefined annotation entries', () => {
    const msg: Message = {
      ...baseMessage(),
      // Cast to exercise the null-guard path
      custom_content: {
        annotations: [null as unknown as Annotation, validAnnotation],
      },
    };
    const { result } = renderHook(() => useAnnotations(msg, false));
    expect(result.current).toHaveLength(1);
  });

  it('returns an empty array for a message with no custom_content', () => {
    const { result } = renderHook(() => useAnnotations(baseMessage(), false));
    expect(result.current).toHaveLength(0);
  });
});
