import { describe, expect, it } from 'vitest';
import { OoxmlFileType } from '../../types/attachment-canvas';
import {
  getOoxmlFileType,
  getOoxmlMimeType,
  isOoxmlPreviewable,
  isTextPreviewable,
} from '../content';

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

  it('prefers the MIME type over a conflicting extension', () => {
    expect(
      getOoxmlFileType(
        'data.xlsx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(OoxmlFileType.Docx);
  });

  it('matches the last segment of a multi-dot name', () => {
    expect(getOoxmlFileType('q3.final.report.docx')).toBe(OoxmlFileType.Docx);
  });

  it('falls back to the extension when the MIME type is generic', () => {
    expect(getOoxmlFileType('budget.xlsx', 'application/octet-stream')).toBe(
      OoxmlFileType.Xlsx,
    );
  });

  it('returns undefined without an extension or a matching MIME type', () => {
    expect(getOoxmlFileType('Quarterly Report')).toBeUndefined();
    expect(
      getOoxmlFileType('Quarterly Report', 'application/octet-stream'),
    ).toBeUndefined();
  });

  it('reports supported formats as previewable', () => {
    expect(isOoxmlPreviewable('slides.pptx')).toBe(true);
    expect(isOoxmlPreviewable('notes.txt')).toBe(false);
  });

  it('rejects legacy Office formats', () => {
    expect(isOoxmlPreviewable('report.doc', 'application/msword')).toBe(false);
    expect(isOoxmlPreviewable('budget.xls')).toBe(false);
    expect(isOoxmlPreviewable('slides.ppt')).toBe(false);
  });

  it('does not route Office files to the text renderer', () => {
    expect(isTextPreviewable('report.docx')).toBe(false);
    expect(isTextPreviewable('budget.xlsx')).toBe(false);
    expect(isTextPreviewable('slides.pptx')).toBe(false);
  });

  it.each([
    [
      'report.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    [
      'budget.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    [
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  ])('resolves the canonical MIME type for %s by extension', (name, mime) => {
    expect(getOoxmlMimeType(name)).toBe(mime);
  });

  it('resolves the canonical MIME type from a recognized but non-canonical MIME string', () => {
    expect(
      getOoxmlMimeType(
        'attachment',
        'APPLICATION/VND.OPENXMLFORMATS-OFFICEDOCUMENT.SPREADSHEETML.SHEET; charset=binary',
      ),
    ).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('returns undefined without an extension or a matching MIME type', () => {
    expect(getOoxmlMimeType('Quarterly Report')).toBeUndefined();
  });
});
