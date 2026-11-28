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

  it.each([
    [
      'does not include the user bucket in the path',
      {
        fileName: 'IMG_4740 2.jpg',
        expected: /^uploads\/\d{4}-\d{2}\/IMG_4740%202\.jpg$/,
      },
    ],
    [
      'URL-encodes unsafe filename characters',
      { fileName: 'my report (1).pdf', expected: /my%20report%20\(1\)\.pdf$/ },
    ],
    [
      'path-traversal slashes are removed before encoding',
      {
        fileName: '../../etc/passwd',
        expected: /^uploads\/\d{4}-\d{2}\/passwd$/,
      },
    ],
    [
      'leading dots are stripped from the encoded file name',
      { fileName: '.hidden-file', expected: /hidden-file$/ },
    ],
    [
      'name with no extension is preserved',
      { fileName: 'README', expected: /README$/ },
    ],
  ])('%s', (_name, { fileName, expected }) => {
    expect(buildUploadPath(fileName)).toMatch(expected);
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

  it.each([
    [
      'inserts the suffix before the extension',
      {
        existingNames: ['report.pdf'],
        name: 'report.pdf',
        expected: 'report (1).pdf',
      },
    ],
    [
      'appends the suffix at the end of an extensionless name',
      { existingNames: ['README'], name: 'README', expected: 'README (1)' },
    ],
    [
      'treats only the last dot as the extension separator',
      {
        existingNames: ['archive.tar.gz'],
        name: 'archive.tar.gz',
        expected: 'archive.tar (1).gz',
      },
    ],
    [
      'sanitizes a leading-dot name before treating it as extensionless',
      { existingNames: ['env'], name: '.env', expected: 'env (1)' },
    ],
    [
      'skips names already present in the destination folder',
      {
        existingNames: ['report.pdf', 'report (1).pdf'],
        name: 'report.pdf',
        expected: 'report (2).pdf',
      },
    ],
    [
      'treats names differing only in case as distinct',
      {
        existingNames: ['Photo.png'],
        name: 'photo.png',
        expected: 'photo.png',
      },
    ],
  ])('%s', (_name, { existingNames, name, expected }) => {
    const allocator = createUploadPathAllocator({ date, existingNames });
    expect(allocator.allocate(name).fileName).toBe(expected);
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

  it('skips a name recorded through markTaken', () => {
    const allocator = createUploadPathAllocator({ date });
    allocator.markTaken('report.pdf');
    expect(allocator.allocate('report.pdf').fileName).toBe('report (1).pdf');
  });

  it('hands a released name back to the next allocation', () => {
    const allocator = createUploadPathAllocator({ date });
    const first = allocator.allocate('report.pdf');
    allocator.release(first.fileName);
    expect(allocator.allocate('report.pdf').fileName).toBe('report.pdf');
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
