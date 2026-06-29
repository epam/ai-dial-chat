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

  it('normalizes raw annotations from custom_fields when custom_content.annotations is absent', () => {
    const msg: Message = {
      ...baseMessage(),
      custom_content: {
        attachments: [
          {
            index: 0,
            title: 'report.pdf',
            type: 'application/pdf',
            url: 'files/report.pdf',
          },
        ],
      },
      custom_fields: {
        annotations: [
          {
            index: 0,
            target: {
              source: { attachment_index: 0 },
              selector: {
                type: 'pdf_region',
                page: 2,
                bbox: { left: 10, top: 20, width: 30, height: 40 },
              },
            },
            body: { title: 'Section 1' },
          },
        ],
      },
    };
    const { result } = renderHook(() => useAnnotations(msg, false));
    expect(result.current).toHaveLength(1);
    const ann = result.current[0];
    expect(ann.index).toBe(0);
    expect(ann.body?.source?.attachment?.url).toBe('files/report.pdf');
    expect(ann.body?.title).toBe('Section 1');
    const sel = ann.body?.selector;
    expect(sel).toMatchObject({
      type: 'pdf_bbox',
      page: 2,
      x1: 10,
      y1: 20,
      x2: 40,
      y2: 60,
    });
  });

  it('skips raw annotations whose attachment_index does not resolve', () => {
    const msg: Message = {
      ...baseMessage(),
      custom_content: {
        attachments: [
          {
            index: 1,
            title: 'other.pdf',
            type: 'application/pdf',
            url: 'files/other.pdf',
          },
        ],
      },
      custom_fields: {
        annotations: [
          {
            index: 0,
            target: {
              source: { attachment_index: 99 },
              selector: {
                type: 'pdf_region',
                page: 1,
                bbox: { left: 0, top: 0, width: 10, height: 10 },
              },
            },
            body: { title: 'Orphan' },
          },
        ],
      },
    };
    const { result } = renderHook(() => useAnnotations(msg, false));
    expect(result.current).toHaveLength(0);
  });
});
