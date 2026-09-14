import {
  type Annotation,
  type AnnotationSelector,
  type DocxRangeSelector,
  type ExcelRcRangeSelector,
  type Message,
  MessageRole,
  MIMEType,
  type PdfBBoxSelector,
  type PptxRangeSelector,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  annotationToOfficeHighlightLocations,
  getAnnotationPdfPage,
  isDocxRangeSelector,
  isExcelRcRangeSelector,
  isPptxRangeSelector,
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

const docxSelector = (
  overrides: Partial<DocxRangeSelector> = {},
): DocxRangeSelector => ({
  type: 'docx_text_range',
  story: 'body',
  path: [3, 1],
  start: 0,
  end: 5,
  text: 'Hello',
  ...overrides,
});

const pptxSelector = (
  overrides: Partial<PptxRangeSelector> = {},
): PptxRangeSelector => ({
  type: 'pptx_text_range',
  slide: 1,
  shape_id: '7',
  start: 0,
  end: 5,
  text: 'Hello',
  ...overrides,
});

const excelSelector = (
  overrides: Partial<ExcelRcRangeSelector> = {},
): ExcelRcRangeSelector => ({
  type: 'excel_rc_range',
  sheet: 'Sheet1',
  start: { row: 14, col: 3 },
  ...overrides,
});

describe('isDocxRangeSelector', () => {
  it('accepts a full docx_text_range selector', () => {
    expect(isDocxRangeSelector(docxSelector())).toBe(true);
  });

  it('rejects a _range-suffixed selector missing the DOCX field set', () => {
    const partial = { type: 'docx_text_range', start: 0, end: 5 };
    expect(isDocxRangeSelector(partial as AnnotationSelector)).toBe(false);
  });

  it('does not also match a pptx_text_range selector', () => {
    expect(isDocxRangeSelector(pptxSelector() as AnnotationSelector)).toBe(
      false,
    );
  });
});

describe('isPptxRangeSelector', () => {
  it('accepts a full pptx_text_range selector', () => {
    expect(isPptxRangeSelector(pptxSelector())).toBe(true);
  });

  it('rejects a _range-suffixed selector missing the PPTX field set', () => {
    const partial = { type: 'pptx_text_range', start: 0, end: 5 };
    expect(isPptxRangeSelector(partial as AnnotationSelector)).toBe(false);
  });

  it('does not also match a docx_text_range selector', () => {
    expect(isPptxRangeSelector(docxSelector() as AnnotationSelector)).toBe(
      false,
    );
  });
});

describe('isExcelRcRangeSelector', () => {
  it('accepts the confirmed literal', () => {
    expect(isExcelRcRangeSelector(excelSelector())).toBe(true);
  });

  it('rejects the same fields under a different type', () => {
    const wrongType = { ...excelSelector(), type: 'excel_range' };
    expect(isExcelRcRangeSelector(wrongType as AnnotationSelector)).toBe(false);
  });

  it('accepts end: null and an omitted end identically', () => {
    expect(isExcelRcRangeSelector(excelSelector({ end: null }))).toBe(true);
    expect(isExcelRcRangeSelector(excelSelector())).toBe(true);
  });
});

describe('annotationToOfficeHighlightLocations', () => {
  it('normalises a valid DOCX selector with endExclusive === end (already exclusive on the wire)', () => {
    const [location] = annotationToOfficeHighlightLocations(
      makeAnnotation(docxSelector({ start: 5, end: 6 })),
    );
    expect(location).toMatchObject({ start: 5, endExclusive: 6 });
  });

  it('boundary: start: 5, end: 6 slices to exactly one character', () => {
    const [location] = annotationToOfficeHighlightLocations(
      makeAnnotation(docxSelector({ start: 5, end: 6, text: 'H' })),
    );
    expect(location).toBeDefined();
    if (location?.type === 'docx_text_range') {
      expect('12345H'.slice(location.start, location.endExclusive)).toBe('H');
    }
  });

  it('boundary: start: 0, end: 10 against 10-character text is not out of bounds', () => {
    const text = '0123456789';
    const [location] = annotationToOfficeHighlightLocations(
      makeAnnotation(docxSelector({ start: 0, end: 10, text })),
    );
    expect(location).toBeDefined();
    if (location?.type === 'docx_text_range') {
      expect(text.slice(location.start, location.endExclusive)).toBe(text);
    }
  });

  it('rejects end < start', () => {
    const result = annotationToOfficeHighlightLocations(
      makeAnnotation(docxSelector({ start: 5, end: 3 })),
    );
    expect(result).toHaveLength(0);
  });

  it('rejects non-integer start and non-numeric end', () => {
    const result = annotationToOfficeHighlightLocations(
      makeAnnotation(
        docxSelector({ start: 1.5 }) as unknown as DocxRangeSelector,
      ),
    );
    expect(result).toHaveLength(0);
  });

  it('keeps only the valid entry in a selector array with one invalid entry', () => {
    const result = annotationToOfficeHighlightLocations(
      makeAnnotation([
        docxSelector({ start: 5, end: 3 }),
        docxSelector(),
      ] as AnnotationSelector[]),
    );
    expect(result).toHaveLength(1);
  });

  it('produces one highlight with two locations for an array of two valid selectors', () => {
    const result = annotationToOfficeHighlightLocations(
      makeAnnotation([docxSelector(), pptxSelector()] as AnnotationSelector[]),
    );
    expect(result).toHaveLength(2);
  });

  it('rejects an XLSX multi-row range and accepts a same-row range', () => {
    const multiRow = annotationToOfficeHighlightLocations(
      makeAnnotation(
        excelSelector({ end: { row: 15, col: 6 } }) as AnnotationSelector,
      ),
    );
    expect(multiRow).toHaveLength(0);

    const sameRow = annotationToOfficeHighlightLocations(
      makeAnnotation(
        excelSelector({ end: { row: 14, col: 6 } }) as AnnotationSelector,
      ),
    );
    expect(sameRow).toHaveLength(1);
  });

  it('treats end: null and an omitted end identically as a single cell', () => {
    const withNull = annotationToOfficeHighlightLocations(
      makeAnnotation(excelSelector({ end: null }) as AnnotationSelector),
    );
    const omitted = annotationToOfficeHighlightLocations(
      makeAnnotation(excelSelector()),
    );
    expect(withNull).toEqual(omitted);
  });

  it('rejects slide: 0, row: 0, col: 0, and an empty sheet', () => {
    expect(
      annotationToOfficeHighlightLocations(
        makeAnnotation(pptxSelector({ slide: 0 })),
      ),
    ).toHaveLength(0);
    expect(
      annotationToOfficeHighlightLocations(
        makeAnnotation(excelSelector({ start: { row: 0, col: 1 } })),
      ),
    ).toHaveLength(0);
    expect(
      annotationToOfficeHighlightLocations(
        makeAnnotation(excelSelector({ start: { row: 1, col: 0 } })),
      ),
    ).toHaveLength(0);
    expect(
      annotationToOfficeHighlightLocations(
        makeAnnotation(excelSelector({ sheet: '' })),
      ),
    ).toHaveLength(0);
  });

  it('produces no locations and does not throw for an annotation with no selector', () => {
    expect(annotationToOfficeHighlightLocations(makeAnnotation())).toEqual([]);
  });

  it('lets an unrecognised type satisfy AnnotationSelector through the open branch, yielding no location', () => {
    const result = annotationToOfficeHighlightLocations(
      makeAnnotation({
        type: 'something_else',
      } as AnnotationSelector),
    );
    expect(result).toHaveLength(0);
  });
});

describe('resolveMessageAnnotations', () => {
  const xlsxMessage = (): Message => ({
    role: MessageRole.Assistant,
    content: 'Budget<cit data-id="xlsx-1"></cit>',
    timestamp: '2026-09-08T10:16:43.739Z',
    custom_content: {
      annotations: [
        {
          target: { selector: { type: 'html_tag', tag: 'cit', id: 'xlsx-1' } },
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
  });

  it('repairs a persisted html_tag XLSX annotation previously mislabeled as PDF', () => {
    const message = xlsxMessage();

    const result = resolveMessageAnnotations(message);

    expect(result[0].body?.source?.attachment.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(
      message.custom_content?.annotations?.[0].body?.source?.attachment.type,
    ).toBe(MIMEType.PDF);
  });

  it('normalizes the raw wire format from custom_fields when custom_content has none', () => {
    const message = {
      role: MessageRole.Assistant,
      content: 'Budget<cit data-id="xlsx-1"></cit>',
      timestamp: '2026-09-08T10:16:43.739Z',
      custom_fields: {
        annotations: [
          {
            target: { selector: { type: 'html_tag', tag: 'cit', id: 'x' } },
            body: {
              title: 'budget.xlsx',
              source: {
                type: 'attachment',
                url: 'files/account/uploads/budget.xlsx',
              },
            },
          },
        ],
      },
    } as Message;

    const result = resolveMessageAnnotations(message);

    expect(result).toHaveLength(1);
    expect(result[0].body?.source?.attachment.url).toBe(
      'files/account/uploads/budget.xlsx',
    );
  });

  it('returns an empty list when the message carries no annotations', () => {
    expect(
      resolveMessageAnnotations({
        role: MessageRole.Assistant,
        content: 'No citations',
        timestamp: '2026-09-08T10:16:43.739Z',
      }),
    ).toEqual([]);
  });
});
