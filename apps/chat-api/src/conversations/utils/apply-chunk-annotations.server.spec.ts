import { describe, expect, it } from 'vitest';
import { AttachmentDto as Attachment } from '../dto/attachment.dto';
import { normalizeRawAnnotationsServer } from './apply-chunk-annotations.server';

describe('normalizeRawAnnotationsServer', () => {
  const attachments: Attachment[] = [];

  it('retains an Office selector in body.selector unchanged through streaming assembly', () => {
    const selector = {
      type: 'docx_range',
      story: 'body',
      path: [3, 1],
      start: 0,
      end: 4,
      text: 'Hello',
    };
    const raw = [
      {
        index: 0,
        target: { selector: { type: 'html_tag', tag: 'cit', id: 'page-3' } },
        body: {
          selector,
          source: { type: 'attachment', url: 'files/bucket/report.docx' },
        },
      },
    ];

    const [annotation] = normalizeRawAnnotationsServer(raw, attachments);

    expect(annotation.body?.selector).toEqual(selector);
  });

  it('retains an excel_rc_range selector with a nested end address unchanged', () => {
    const selector = {
      type: 'excel_rc_range',
      sheet: 'Sheet1',
      start: { row: 14, col: 3 },
      end: { row: 14, col: 6 },
    };
    const raw = [
      {
        index: 0,
        target: { selector: { type: 'html_tag', tag: 'cit', id: 'page-3' } },
        body: {
          selector,
          source: { type: 'attachment', url: 'files/bucket/ledger.xlsx' },
        },
      },
    ];

    const [annotation] = normalizeRawAnnotationsServer(raw, attachments);

    expect(annotation.body?.selector).toEqual(selector);
  });
});
