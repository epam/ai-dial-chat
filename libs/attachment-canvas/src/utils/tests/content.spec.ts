import { describe, expect, it } from 'vitest';
import { OoxmlFileType } from '../../types/attachment-canvas';
import { getOoxmlFileType, isOoxmlPreviewable } from '../content';

describe('OOXML content detection', () => {
  it.each([
    ['report.DOCX', OoxmlFileType.Docx],
    ['budget.xlsx', OoxmlFileType.Xlsx],
    ['slides.pptx', OoxmlFileType.Pptx],
  ])('detects %s by extension', (name, expected) => {
    expect(getOoxmlFileType(name)).toBe(expected);
  });

  it.each([
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      OoxmlFileType.Docx,
    ],
    [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      OoxmlFileType.Xlsx,
    ],
    [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      OoxmlFileType.Pptx,
    ],
  ])('detects a document by MIME type', (mimeType, expected) => {
    expect(getOoxmlFileType('attachment', mimeType)).toBe(expected);
  });

  it('accepts a case-insensitive MIME type with parameters', () => {
    expect(
      getOoxmlFileType(
        'attachment',
        'APPLICATION/VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT; charset=binary',
      ),
    ).toBe(OoxmlFileType.Docx);
  });

  it('rejects legacy Office formats', () => {
    expect(isOoxmlPreviewable('report.doc', 'application/msword')).toBe(false);
    expect(isOoxmlPreviewable('budget.xls')).toBe(false);
    expect(isOoxmlPreviewable('slides.ppt')).toBe(false);
  });
});
