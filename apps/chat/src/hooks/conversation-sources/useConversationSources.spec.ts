import {
  AttachmentType,
  MessageRole,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import type { Message } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConversationSources } from './useConversationSources';

const makeMessage = (
  role: MessageRole,
  attachments?: { title: string; type: string; url?: string }[],
): Message => ({
  id: Math.random().toString(),
  role,
  content: 'text',
  timestamp: new Date().toISOString(),
  ...(attachments ? { custom_content: { attachments } } : {}),
});

describe('useConversationSources', () => {
  it('returns empty lists for no messages', () => {
    const { result } = renderHook(() => useConversationSources([]));
    expect(result.current.uploaded).toEqual([]);
    expect(result.current.generated).toEqual([]);
  });

  it('puts user-message attachments in uploaded', () => {
    const messages = [
      makeMessage(MessageRole.User, [
        { title: 'file.pdf', type: 'application/pdf' },
      ]),
    ];
    const { result } = renderHook(() => useConversationSources(messages));
    expect(result.current.uploaded).toHaveLength(1);
    expect(result.current.uploaded[0].name).toBe('file.pdf');
    expect(result.current.generated).toHaveLength(0);
  });

  it('puts assistant-message attachments in generated', () => {
    const messages = [
      makeMessage(MessageRole.Assistant, [
        { title: 'result.csv', type: 'text/csv' },
      ]),
    ];
    const { result } = renderHook(() => useConversationSources(messages));
    expect(result.current.generated).toHaveLength(1);
    expect(result.current.generated[0].name).toBe('result.csv');
    expect(result.current.uploaded).toHaveLength(0);
  });

  it('handles mixed roles in order', () => {
    const messages = [
      makeMessage(MessageRole.User, [
        { title: 'upload.png', type: 'image/png', url: '/img.png' },
      ]),
      makeMessage(MessageRole.Assistant, [
        { title: 'a.pdf', type: 'application/pdf' },
        { title: 'b.csv', type: 'text/csv' },
      ]),
    ];
    const { result } = renderHook(() => useConversationSources(messages));
    expect(result.current.uploaded).toHaveLength(1);
    expect(result.current.generated).toHaveLength(2);
  });

  it('maps image attachment type correctly', () => {
    const messages = [
      makeMessage(MessageRole.User, [
        { title: 'photo.png', type: 'image/png', url: '/photo.png' },
      ]),
    ];
    const { result } = renderHook(() => useConversationSources(messages));
    expect(result.current.uploaded[0].type).toBe(AttachmentType.Image);
    expect(result.current.uploaded[0].status).toBe(RequestStatus.Idle);
  });

  it('ignores messages without custom_content', () => {
    const messages = [
      makeMessage(MessageRole.User),
      makeMessage(MessageRole.Assistant),
    ];
    const { result } = renderHook(() => useConversationSources(messages));
    expect(result.current.uploaded).toHaveLength(0);
    expect(result.current.generated).toHaveLength(0);
  });

  it('returns the same object reference when messages ref is stable', () => {
    const messages: Message[] = [];
    const { result, rerender } = renderHook(() =>
      useConversationSources(messages),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
