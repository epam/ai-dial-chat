import {
  AttachmentType,
  MessageRole,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import type { Annotation, Message } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConversationSources } from '../useConversationSources';

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

const makeAnnotation = (url: string, page?: number): Annotation =>
  ({
    body: {
      source: {
        type: 'attachment',
        attachment: { type: 'application/pdf', url, title: 'Report' },
      },
      ...(page != null
        ? {
            selector: {
              type: 'pdf_bbox',
              page,
              x1: 0,
              y1: 0,
              x2: 0,
              y2: 0,
            },
          }
        : {}),
    },
  }) as unknown as Annotation;

const makeAnnotatedMessage = (
  annotations: Annotation[],
  attachments?: Record<string, unknown>[],
): Message =>
  ({
    id: Math.random().toString(),
    role: MessageRole.Assistant,
    content: 'text',
    timestamp: new Date().toISOString(),
    custom_content: { annotations, ...(attachments ? { attachments } : {}) },
  }) as unknown as Message;

const sourceUrlsOf = (messages: Message[]) =>
  renderHook(() => useConversationSources(messages)).result.current.sources.map(
    (source) => source.url,
  );

describe('useConversationSources — PDF page sources', () => {
  it('qualifies a PDF citation URL with its cited page', () => {
    const messages = [
      makeAnnotatedMessage([makeAnnotation('files/bucket/doc.pdf', 12)]),
    ];

    expect(sourceUrlsOf(messages)).toEqual(['files/bucket/doc.pdf#page=12']);
  });

  it('lists one source per cited page of the same PDF, in citation order', () => {
    const messages = [
      makeAnnotatedMessage([
        makeAnnotation('files/bucket/doc.pdf', 3),
        makeAnnotation('files/bucket/doc.pdf', 7),
      ]),
    ];

    expect(sourceUrlsOf(messages)).toEqual([
      'files/bucket/doc.pdf#page=3',
      'files/bucket/doc.pdf#page=7',
    ]);
  });

  it('lists a PDF page cited twice only once', () => {
    const messages = [
      makeAnnotatedMessage([
        makeAnnotation('files/bucket/doc.pdf', 3),
        makeAnnotation('files/bucket/doc.pdf', 3),
      ]),
    ];

    expect(sourceUrlsOf(messages)).toEqual(['files/bucket/doc.pdf#page=3']);
  });

  it('keeps the title derived from the file, not the page-qualified URL', () => {
    const annotation = makeAnnotation('files/bucket/doc.pdf', 3);
    (annotation.body?.source?.attachment as { title?: string }).title =
      undefined;
    const { result } = renderHook(() =>
      useConversationSources([makeAnnotatedMessage([annotation])]),
    );

    expect(result.current.sources[0].title).toBe('doc.pdf');
  });

  it.each([
    ['has no PDF selector', makeAnnotation('files/bucket/doc.pdf')],
    ['is not a PDF URL', makeAnnotation('files/bucket/notes.md', 3)],
    [
      'already carries a page fragment',
      makeAnnotation('files/bucket/doc.pdf#page=5', 3),
    ],
  ])('keeps the URL unchanged when the citation %s', (_, annotation) => {
    const url = annotation.body?.source?.attachment?.url;

    expect(sourceUrlsOf([makeAnnotatedMessage([annotation])])).toEqual([url]);
  });

  it('lists a reference link and a citation of the same PDF page once, keeping the reference', () => {
    const messages = [
      makeAnnotatedMessage(
        [makeAnnotation('files/bucket/doc.pdf', 3)],
        [
          {
            type: 'application/pdf',
            title: 'Reference',
            reference_url: 'files/bucket/doc.pdf#page=3',
            reference_type: 'application/pdf',
          },
        ],
      ),
    ];
    const { result } = renderHook(() => useConversationSources(messages));

    expect(result.current.sources).toHaveLength(1);
    expect(result.current.sources[0].title).toBe('Reference');
  });
});
