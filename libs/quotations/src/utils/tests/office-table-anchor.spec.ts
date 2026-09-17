import type { Annotation } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { annotationToOfficeHighlightLocations } from '../annotation';

const docxText =
  '| Latency budget | Platform | Raise capacity review when p95 latency exceeds 900 ms twice in one week. |';
const pptxText =
  '| API Gateway latency budget | Platform | PPTX\\_TABLE\\_TARGET\\_BRAVO: Escalate to Architecture Council when p95 gateway latency exceeds 750 ms in two consecutive checks. |';

const locations = (selector: unknown) =>
  annotationToOfficeHighlightLocations({
    body: { selector },
  } as Annotation);

describe('temporary Office table anchors (#8863)', () => {
  it('accepts the DOCX payload without inventing a cell or character offset', () => {
    expect(
      locations([{ type: 'docx_text_anchor', text: docxText, occurrence: 1 }]),
    ).toEqual([
      {
        type: 'docx_text_anchor',
        cells: [
          'Latency budget',
          'Platform',
          'Raise capacity review when p95 latency exceeds 900 ms twice in one week.',
        ],
        occurrence: 1,
      },
    ]);
  });

  it('decodes escaped Markdown in the PPTX payload and keeps its slide', () => {
    expect(
      locations({
        type: 'pptx_text_anchor',
        text: pptxText,
        occurrence: 1,
        slide: 2,
      }),
    ).toEqual([
      {
        type: 'pptx_text_anchor',
        cells: [
          'API Gateway latency budget',
          'Platform',
          'PPTX_TABLE_TARGET_BRAVO: Escalate to Architecture Council when p95 gateway latency exceeds 750 ms in two consecutive checks.',
        ],
        occurrence: 1,
        slide: 2,
      },
    ]);
  });

  it('preserves escaped literal pipes, backslashes and empty cells', () => {
    expect(
      locations({
        type: 'docx_text_anchor',
        text: '| A\\|B | C\\\\D | |',
        occurrence: 2,
      })[0],
    ).toMatchObject({
      cells: ['A|B', 'C\\D', ''],
      occurrence: 2,
    });
  });

  it.each([undefined, 0, -1, 1.5, NaN, Infinity, '1'])(
    'rejects an invalid occurrence (%s)',
    (occurrence) => {
      expect(
        locations({ type: 'docx_text_anchor', text: docxText, occurrence }),
      ).toEqual([]);
    },
  );

  it.each([undefined, 0, -1, 1.5, '2'])(
    'rejects an invalid PPTX slide (%s)',
    (slide) => {
      expect(
        locations({
          type: 'pptx_text_anchor',
          text: pptxText,
          occurrence: 1,
          slide,
        }),
      ).toEqual([]);
    },
  );

  it.each([
    '',
    'plain paragraph',
    '| A | B',
    '| A |',
    '| | |',
    '| --- | :---: |',
    '| A | B |\n| C | D |',
    '| A | B\\|',
  ])('does not guess a table row from unsupported text (%s)', (text) => {
    expect(
      locations({ type: 'docx_text_anchor', text, occurrence: 1 }),
    ).toEqual([]);
  });

  it('does not apply the workaround to stale ranges or unknown selectors', () => {
    expect(
      locations([
        { type: 'future_text_anchor', text: docxText, occurrence: 1 },
        { type: 'docx_text_range', text: docxText, occurrence: 1 },
        null,
      ]),
    ).toEqual([]);
  });
});
