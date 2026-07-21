import type { Attachment } from '@epam/ai-dial-chat-shared';
import { AttachmentType, RequestStatus } from '@epam/ai-dial-chat-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildImportUploadPath, buildUploadPath } from '../build-upload-path';

const makeAttachment = (name: string): Attachment => ({
  id: 'att-1',
  name,
  contentType: 'application/octet-stream',
  type: AttachmentType.File,
  status: RequestStatus.Idle,
  file: new File([], name),
});

describe('buildUploadPath', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the current year-month as prefix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'));
    const path = buildUploadPath(makeAttachment('file.pdf'));
    expect(path).toBe('uploads/2026-06/file.pdf');
  });

  it('does not include the user bucket in the path', () => {
    const path = buildUploadPath(makeAttachment('IMG_4740 2.jpg'));
    expect(path).toMatch(/^uploads\/\d{4}-\d{2}\/IMG_4740%202\.jpg$/);
  });

  it('URL-encodes unsafe filename characters', () => {
    const path = buildUploadPath(makeAttachment('my report (1).pdf'));
    expect(path).toMatch(/my%20report%20\(1\)\.pdf$/);
  });

  it('path-traversal slashes are removed before encoding', () => {
    const path = buildUploadPath(makeAttachment('../../etc/passwd'));
    expect(path).toMatch(/^uploads\/\d{4}-\d{2}\/passwd$/);
  });

  it('leading dots are stripped from the encoded file name', () => {
    const path = buildUploadPath(makeAttachment('.hidden-file'));
    expect(path).toMatch(/hidden-file$/);
  });

  it('name with no extension is preserved', () => {
    const path = buildUploadPath(makeAttachment('README'));
    expect(path).toMatch(/README$/);
  });
});

describe('buildImportUploadPath', () => {
  const date = new Date(2026, 6, 17);

  it('builds a day-level upload path', () => {
    expect(buildImportUploadPath('report.pdf', date)).toBe(
      'uploads/2026-07-17/report.pdf',
    );
  });

  it('sanitizes and encodes the file name', () => {
    expect(buildImportUploadPath('../../etc/passwd', date)).toBe(
      'uploads/2026-07-17/passwd',
    );
  });

  it('builds the same path for two same-named files (no de-duplication)', () => {
    expect(buildImportUploadPath('photo.png', date)).toBe(
      buildImportUploadPath('photo.png', date),
    );
  });
});
