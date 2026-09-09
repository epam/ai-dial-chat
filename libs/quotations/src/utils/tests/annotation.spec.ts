import {
  type Annotation,
  type AnnotationSelector,
  type Message,
  type MessageAttachment,
  MessageRole,
  MIMEType,
  type PdfBBoxSelector,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getAnnotationPdfPage,
  normalizeRawAnnotations,
  resolveMessageAnnotations,
} from '../annotation';

const bbox = (overrides: Partial<PdfBBoxSelector> = {}): PdfBBoxSelector => ({
  type: 'pdf_bbox',
  page: 3,
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 0,
  ...overrides,
});

const makeAnnotation = (
  selector?: AnnotationSelector | AnnotationSelector[],
): Annotation => ({ body: { selector } });

describe('getAnnotationPdfPage', () => {
  it('skips malformed selectors and invalid pages before a valid PDF page', () => {
    const selector = [
      null,
      4,
      { type: 'pdf_bbox', page: 0 },
      bbox({ page: 7 }),
    ];
    expect(
      getAnnotationPdfPage(makeAnnotation(selector as AnnotationSelector[])),
    ).toBe(7);
  });
  it('returns the page from a single pdf_bbox selector', () => {
    expect(getAnnotationPdfPage(makeAnnotation(bbox({ page: 5 })))).toBe(5);
  });

  it('returns the page from an array of selectors where the pdf_bbox entry is not first', () => {
    const selector = [
      { type: 'text_character_range', start: 0, end: 1 },
      bbox({ page: 7 }),
    ];
    expect(getAnnotationPdfPage(makeAnnotation(selector))).toBe(7);
  });

  it('returns undefined when the selector array has no pdf_bbox entry', () => {
    const selector = [{ type: 'text_character_range', start: 0, end: 1 }];
    expect(getAnnotationPdfPage(makeAnnotation(selector))).toBeUndefined();
  });

  it('returns undefined when the annotation has no body.selector', () => {
    expect(getAnnotationPdfPage(makeAnnotation(undefined))).toBeUndefined();
  });

  it('returns undefined when page is missing', () => {
    const selector = { type: 'pdf_bbox', x1: 0, y1: 0, x2: 0, y2: 0 };
    expect(getAnnotationPdfPage(makeAnnotation(selector))).toBeUndefined();
  });

  it('returns undefined when page is 0', () => {
    expect(
      getAnnotationPdfPage(makeAnnotation(bbox({ page: 0 }))),
    ).toBeUndefined();
  });

  it('returns undefined when page is negative', () => {
    expect(
      getAnnotationPdfPage(makeAnnotation(bbox({ page: -1 }))),
    ).toBeUndefined();
  });

  it('returns undefined when page is not an integer', () => {
    expect(
      getAnnotationPdfPage(makeAnnotation(bbox({ page: 1.5 }))),
    ).toBeUndefined();
  });

  it('returns the page even when all bounding-box coordinates are zero', () => {
    const selector = bbox({ page: 5, x1: 0, y1: 0, x2: 0, y2: 0 });
    expect(getAnnotationPdfPage(makeAnnotation(selector))).toBe(5);
  });
});

const sampleHtmlTagRaw = (id: string, quote: string) => ({
  target: {
    selector: { type: 'html_tag', tag: 'cit', id },
  },
  body: {
    title: 'MT_14dayTrialNote (2).pdf',
    quote,
    source: {
      type: 'attachment',
      url: 'files/6By4GofuFvWFzB2WZRdmGvG9Qa9heuo4E1DkiZPaeT7ApzUK2tUfMBNX6LZDG3beNY/uploads/2026-09/MT_14dayTrialNote%20(2).pdf',
    },
  },
});

describe('normalizeRawAnnotations', () => {
  it.each([false, true])(
    'retains PDF body selectors and annotation index for an html_tag citation (array: %s)',
    (asArray) => {
      const selector = asArray ? [bbox(), bbox({ page: 7 })] : bbox();
      const raw = sampleHtmlTagRaw('page-citation', 'Quote');
      const [annotation] = normalizeRawAnnotations(
        [{ ...raw, index: 4, body: { ...raw.body, selector } }],
        [],
      );
      expect(annotation.index).toBe(4);
      expect(annotation.target?.selector).toEqual(raw.target.selector);
      expect(annotation.body?.selector).toEqual(selector);
      expect(getAnnotationPdfPage(annotation)).toBe(3);
    },
  );
  it('normalizes two html_tag annotations citing the same source URL into two entries', () => {
    const raw = [
      sampleHtmlTagRaw(
        'e43864',
        'Patient meets ALL criteria for Stage 2 permanent implantation',
      ),
      sampleHtmlTagRaw(
        'e52dc2',
        'Recommend proceeding with Stage 2 — implantation of permanent implantable pulse generator (IPG) — Medtronic InterStim X.',
      ),
    ];

    const result = normalizeRawAnnotations(raw, []);

    expect(result).toHaveLength(2);
    expect(result[0].index).toBeUndefined();
    expect(result[0].target?.selector).toEqual({
      type: 'html_tag',
      tag: 'cit',
      id: 'e43864',
    });
    expect(result[0].body?.source?.attachment.url).toBe(
      'files/6By4GofuFvWFzB2WZRdmGvG9Qa9heuo4E1DkiZPaeT7ApzUK2tUfMBNX6LZDG3beNY/uploads/2026-09/MT_14dayTrialNote%20(2).pdf',
    );
    expect(result[0].body?.source?.attachment.title).toBe(
      'MT_14dayTrialNote (2).pdf',
    );
    expect(result[0].body?.title).toBe('MT_14dayTrialNote (2).pdf');
    expect(result[1].target?.selector).toMatchObject({ id: 'e52dc2' });
  });

  it('still normalizes the legacy attachment_index + pdf_region shape', () => {
    const attachments: MessageAttachment[] = [
      {
        index: 0,
        title: 'report.pdf',
        type: 'application/pdf',
        url: 'files/report.pdf',
      },
    ];
    const raw = [
      {
        index: 0,
        target: {
          source: { attachment_index: 0 },
          selector: {
            type: 'pdf_region',
            page: 1,
            bbox: { left: 1, top: 2, width: 3, height: 4 },
          },
        },
        body: { title: 'Section 1' },
      },
    ];

    const result = normalizeRawAnnotations(raw, attachments);

    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(0);
    expect(result[0].body?.source?.attachment.url).toBe('files/report.pdf');
    expect(result[0].body?.selector).toMatchObject({
      type: 'pdf_bbox',
      page: 1,
      x1: 1,
      y1: 2,
      x2: 4,
      y2: 6,
    });
  });

  it('infers the XLSX MIME type for a raw html_tag annotation', () => {
    const raw = [
      {
        target: { selector: { type: 'html_tag', tag: 'cit', id: 'xlsx-1' } },
        body: {
          title: 'budget.xlsx',
          source: {
            type: 'attachment',
            url: 'files/account/uploads/budget.xlsx',
          },
        },
      },
    ];

    const result = normalizeRawAnnotations(raw, []);

    expect(result[0].body?.source?.attachment.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
  });

  it('repairs a persisted html_tag XLSX annotation previously mislabeled as PDF', () => {
    const message: Message = {
      role: MessageRole.Assistant,
      content: 'Budget<cit data-id="xlsx-1"></cit>',
      timestamp: '2026-09-08T10:16:43.739Z',
      custom_content: {
        annotations: [
          {
            target: {
              selector: { type: 'html_tag', tag: 'cit', id: 'xlsx-1' },
            },
            body: {
              source: {
                type: 'attachment',
                attachment: {
                  type: MIMEType.PDF,
                  url: 'files/account/uploads/budget.xlsx',
                  title: 'budget.xlsx',
                },
              },
            },
          },
        ],
      },
    };

    const result = resolveMessageAnnotations(message);

    expect(result[0].body?.source?.attachment.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(
      message.custom_content?.annotations?.[0].body?.source?.attachment.type,
    ).toBe(MIMEType.PDF);
  });

  it('drops an entry matching neither wire shape', () => {
    const raw = [{ target: { selector: { type: 'unknown' } }, body: {} }];

    const result = normalizeRawAnnotations(raw, []);

    expect(result).toHaveLength(0);
  });

  it('drops an html_tag entry missing a flat body.source.url', () => {
    const raw = [
      {
        target: { selector: { type: 'html_tag', tag: 'cit', id: 'e1' } },
        body: { title: 'no source' },
      },
    ];

    const result = normalizeRawAnnotations(raw, []);

    expect(result).toHaveLength(0);
  });
});
