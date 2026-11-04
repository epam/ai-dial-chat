import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  getArchiveEntryUploadError,
  resolveArchiveEntryPath,
} from '../../upload/archive-upload';

describe('resolveArchiveEntryPath', () => {
  it('rejects a parent-directory traversal segment', () => {
    expect(resolveArchiveEntryPath('../../etc/passwd')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });

  it('rejects an absolute path', () => {
    expect(resolveArchiveEntryPath('/etc/passwd')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });

  it('rejects a Windows drive-letter absolute path', () => {
    expect(resolveArchiveEntryPath('C:\\Windows\\System32\\config')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });

  it('accepts a valid nested relative path', () => {
    expect(resolveArchiveEntryPath('reports/2026/q1.pdf')).toEqual({
      isDirectory: false,
      safeRelativePath: 'reports/2026/q1.pdf',
    });
  });

  it('identifies directory entries for silent skipping', () => {
    expect(resolveArchiveEntryPath('reports/')).toEqual({
      isDirectory: true,
      safeRelativePath: null,
    });
  });

  it('rejects a blank (non-directory) entry name', () => {
    expect(resolveArchiveEntryPath('')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });

  it('rejects a bare parent-directory entry name', () => {
    expect(resolveArchiveEntryPath('..')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });

  it('rejects a single-dot segment (current-directory alias)', () => {
    expect(resolveArchiveEntryPath('a/./b')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
    expect(resolveArchiveEntryPath('.')).toEqual({
      isDirectory: false,
      safeRelativePath: null,
    });
  });
});

describe('getArchiveEntryUploadError', () => {
  it('reports a conflict as Conflict', () => {
    expect(getArchiveEntryUploadError(new ConflictException('exists'))).toBe(
      'Conflict',
    );
  });

  it('reports another HTTP exception by its message', () => {
    expect(getArchiveEntryUploadError(new NotFoundException('gone'))).toBe(
      'gone',
    );
  });

  it('reports a non-HTTP error as Upload failed', () => {
    expect(getArchiveEntryUploadError(new Error('socket'))).toBe(
      'Upload failed',
    );
  });
});
