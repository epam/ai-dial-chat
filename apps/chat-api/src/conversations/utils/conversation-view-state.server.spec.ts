import { describe, expect, it } from 'vitest';
import { AnnotationDto as Annotation } from '../dto/annotation.dto';
import { mergeHtmlTagAnnotationsIntoViewState } from './conversation-view-state.server';

const makeHtmlTagAnnotation = (
  id: string,
  url = 'https://example.com/doc.pdf',
): Annotation => ({
  target: { selector: { type: 'html_tag', tag: 'cit', id } },
  body: {
    title: 'doc.pdf',
    source: {
      type: 'attachment',
      attachment: { type: 'application/pdf', url },
    },
  },
});

const makeOffsetAnnotation = (end = 5): Annotation => ({
  target: { selector: { type: 'text_character_range', start: 0, end } },
  body: {
    title: 'doc.pdf',
    source: {
      type: 'attachment',
      attachment: {
        type: 'application/pdf',
        url: 'https://example.com/doc.pdf',
      },
    },
  },
});

describe('mergeHtmlTagAnnotationsIntoViewState', () => {
  it('creates the annotations key on the first qualifying write', () => {
    const e1 = makeHtmlTagAnnotation('e1');
    const e2 = makeHtmlTagAnnotation('e2');

    const result = mergeHtmlTagAnnotationsIntoViewState(undefined, [e1, e2]);

    expect(result).toEqual({ annotations: [e1, e2] });
  });

  it('discards a duplicate id and keeps the original stored entry', () => {
    const original = makeHtmlTagAnnotation(
      'e1',
      'https://example.com/original.pdf',
    );
    const duplicate = makeHtmlTagAnnotation(
      'e1',
      'https://example.com/duplicate.pdf',
    );
    const current = { annotations: [original] };

    const result = mergeHtmlTagAnnotationsIntoViewState(current, [duplicate]);

    expect(result).toBe(current);
    expect(result?.['annotations']).toEqual([original]);
  });

  it('preserves unrelated customViewState keys while appending a new entry', () => {
    const e1 = makeHtmlTagAnnotation('e1');
    const e2 = makeHtmlTagAnnotation('e2');
    const current = { annotations: [e1], layout: 'wide' };

    const result = mergeHtmlTagAnnotationsIntoViewState(current, [e2]);

    expect(result).toEqual({ annotations: [e1, e2], layout: 'wide' });
  });

  it('leaves an absent customViewState absent when annotations are all offset-based', () => {
    const result = mergeHtmlTagAnnotationsIntoViewState(undefined, [
      makeOffsetAnnotation(),
    ]);

    expect(result).toBeUndefined();
  });

  it('skips a null or malformed entry without throwing', () => {
    const e1 = makeHtmlTagAnnotation('e1');
    const malformed = {
      target: { selector: { type: 'html_tag' } },
    } as Annotation;

    expect(() =>
      mergeHtmlTagAnnotationsIntoViewState(undefined, [
        null as unknown as Annotation,
        malformed,
        e1,
      ]),
    ).not.toThrow();

    const result = mergeHtmlTagAnnotationsIntoViewState(undefined, [
      null as unknown as Annotation,
      malformed,
      e1,
    ]);
    expect(result).toEqual({ annotations: [e1] });
  });
});
