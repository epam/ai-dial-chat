import type { Annotation } from '@epam/ai-dial-chat-shared';
import { MIMEType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { isWebLinkAnnotation } from '../citation-source-kind';

const makeAnnotation = (type: string): Annotation => ({
  body: {
    title: 'Source',
    source: {
      type: 'attachment',
      attachment: { type, url: 'files/bucket/source' },
    },
  },
});

describe('isWebLinkAnnotation', () => {
  it('treats an html source as a web link', () => {
    expect(isWebLinkAnnotation(makeAnnotation(MIMEType.HTML))).toBe(true);
  });

  it('treats an xhtml source as a web link', () => {
    expect(isWebLinkAnnotation(makeAnnotation(MIMEType.XHTML))).toBe(true);
  });

  it('treats a pdf source as a file', () => {
    expect(isWebLinkAnnotation(makeAnnotation(MIMEType.PDF))).toBe(false);
  });

  it('treats an Office source as a file', () => {
    expect(
      isWebLinkAnnotation(
        makeAnnotation(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ),
    ).toBe(false);
  });

  it('treats an annotation without a source attachment as a file', () => {
    expect(isWebLinkAnnotation({ body: { title: 'No source' } })).toBe(false);
  });
});
