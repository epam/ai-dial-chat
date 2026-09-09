import type {
  Annotation,
  AnnotationSelector,
  PdfBBoxSelector,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { getAnnotationPdfPage } from '../annotation';

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
