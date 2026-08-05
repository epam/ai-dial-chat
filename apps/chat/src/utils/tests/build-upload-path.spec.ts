import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildUploadPath,
  createUploadPathAllocator,
} from '../build-upload-path';

describe('buildUploadPath', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the current year-month as prefix when no date is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'));
    const path = buildUploadPath('file.pdf');
    expect(path).toBe('uploads/2026-06/file.pdf');
  });

  it('uses the given date as prefix', () => {
    const date = new Date(2026, 6, 17);
    expect(buildUploadPath('report.pdf', date)).toBe(
      'uploads/2026-07/report.pdf',
    );
  });

  it('does not include the user bucket in the path', () => {
    const path = buildUploadPath('IMG_4740 2.jpg');
    expect(path).toMatch(/^uploads\/\d{4}-\d{2}\/IMG_4740%202\.jpg$/);
  });

  it('URL-encodes unsafe filename characters', () => {
    const path = buildUploadPath('my report (1).pdf');
    expect(path).toMatch(/my%20report%20\(1\)\.pdf$/);
  });

  it('path-traversal slashes are removed before encoding', () => {
    const path = buildUploadPath('../../etc/passwd');
    expect(path).toMatch(/^uploads\/\d{4}-\d{2}\/passwd$/);
  });

  it('leading dots are stripped from the encoded file name', () => {
    const path = buildUploadPath('.hidden-file');
    expect(path).toMatch(/hidden-file$/);
  });

  it('name with no extension is preserved', () => {
    const path = buildUploadPath('README');
    expect(path).toMatch(/README$/);
  });

  it('builds the same path for two same-named files on the same date when no allocator is involved', () => {
    const date = new Date(2026, 6, 17);
    expect(buildUploadPath('photo.png', date)).toBe(
      buildUploadPath('photo.png', date),
    );
  });
});

describe('createUploadPathAllocator', () => {
  const date = new Date(2026, 7, 3);

  it('returns the requested name unchanged for the first allocation', () => {
    const allocator = createUploadPathAllocator({ date });
    expect(allocator.allocate('report.pdf')).toEqual({
      path: 'uploads/2026-08/report.pdf',
      fileName: 'report.pdf',
      isRenamed: false,
    });
  });

  it('appends an incrementing suffix to repeated allocations of one name', () => {
    const allocator = createUploadPathAllocator({ date });
    expect(allocator.allocate('report.pdf').fileName).toBe('report.pdf');
    expect(allocator.allocate('report.pdf').fileName).toBe('report (1).pdf');
    expect(allocator.allocate('report.pdf').fileName).toBe('report (2).pdf');
  });

  it('marks a suffixed allocation as renamed', () => {
    const allocator = createUploadPathAllocator({ date });
    expect(allocator.allocate('report.pdf').isRenamed).toBe(false);
    expect(allocator.allocate('report.pdf').isRenamed).toBe(true);
  });

  it('inserts the suffix before the extension', () => {
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['report.pdf'],
    });
    expect(allocator.allocate('report.pdf').fileName).toBe('report (1).pdf');
  });

  it('appends the suffix at the end of an extensionless name', () => {
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['README'],
    });
    expect(allocator.allocate('README').fileName).toBe('README (1)');
  });

  it('treats only the last dot as the extension separator', () => {
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['archive.tar.gz'],
    });
    expect(allocator.allocate('archive.tar.gz').fileName).toBe(
      'archive.tar (1).gz',
    );
  });

  it('sanitizes a leading-dot name before treating it as extensionless', () => {
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['env'],
    });
    expect(allocator.allocate('.env').fileName).toBe('env (1)');
  });

  it('skips names already present in the destination folder', () => {
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['report.pdf', 'report (1).pdf'],
    });
    expect(allocator.allocate('report.pdf').fileName).toBe('report (2).pdf');
  });

  it('percent-encodes the suffixed name in the returned path', () => {
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['report.pdf'],
    });
    expect(allocator.allocate('report.pdf').path).toBe(
      'uploads/2026-08/report%20(1).pdf',
    );
  });

  it('treats names differing only in case as distinct', () => {
    const allocator = createUploadPathAllocator({
      date,
      existingNames: ['Photo.png'],
    });
    expect(allocator.allocate('photo.png').fileName).toBe('photo.png');
  });

  it('skips a name recorded through markTaken', () => {
    const allocator = createUploadPathAllocator({ date });
    allocator.markTaken('report.pdf');
    expect(allocator.allocate('report.pdf').fileName).toBe('report (1).pdf');
  });

  it('sanitizes the requested name before probing for collisions', () => {
    const allocator = createUploadPathAllocator({ date });
    expect(allocator.allocate('report.pdf').fileName).toBe('report.pdf');
    expect(allocator.allocate('../../report.pdf').fileName).toBe(
      'report (1).pdf',
    );
  });

  it('defaults to the current month when no date is given', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T00:00:00Z'));
    const allocator = createUploadPathAllocator();
    expect(allocator.allocate('file.pdf').path).toBe(
      'uploads/2026-06/file.pdf',
    );
    vi.useRealTimers();
  });
});
