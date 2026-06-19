import { describe, expect, it } from 'vitest';
import { normalizeFileItem } from '../normalize-file-item';

const BUCKET = 'user-bucket';

describe('normalizeFileItem', () => {
  it('lowercases FOLDER nodeType', () => {
    const result = normalizeFileItem(
      { nodeType: 'FOLDER', url: 'folder/', name: 'folder' },
      BUCKET,
    );
    expect(result.nodeType).toBe('folder');
  });

  it('lowercases ITEM nodeType', () => {
    const result = normalizeFileItem(
      { nodeType: 'ITEM', url: 'file.pdf', name: 'file.pdf', parentPath: '' },
      BUCKET,
    );
    expect(result.nodeType).toBe('item');
  });

  it('ensures trailing slash on folder path', () => {
    const result = normalizeFileItem(
      { nodeType: 'FOLDER', url: 'reports', name: 'reports' },
      BUCKET,
    );
    expect(result.path).toBe('reports/');
  });

  it('does not double trailing slash on folder path', () => {
    const result = normalizeFileItem(
      { nodeType: 'FOLDER', url: 'reports/', name: 'reports' },
      BUCKET,
    );
    expect(result.path).toBe('reports/');
  });

  it('sets folder folderId to bucket:path/', () => {
    const result = normalizeFileItem(
      { nodeType: 'FOLDER', url: 'folder/subfolder', name: 'subfolder' },
      BUCKET,
    );
    expect(result.folderId).toBe(`${BUCKET}:folder/subfolder/`);
  });

  it('omits contentLength for folder items', () => {
    const result = normalizeFileItem(
      {
        nodeType: 'FOLDER',
        url: 'folder/',
        name: 'folder',
        contentLength: 123,
      },
      BUCKET,
    );
    expect(result.contentLength).toBeUndefined();
  });

  it('omits contentType for folder items', () => {
    const result = normalizeFileItem(
      {
        nodeType: 'FOLDER',
        url: 'folder/',
        name: 'folder',
        contentType: 'text/plain',
      },
      BUCKET,
    );
    expect(result.contentType).toBeUndefined();
  });

  it('sets file folderId to bucket:parentPath', () => {
    const result = normalizeFileItem(
      {
        nodeType: 'ITEM',
        url: 'folder/file.pdf',
        name: 'file.pdf',
        parentPath: 'folder/',
      },
      BUCKET,
    );
    expect(result.folderId).toBe(`${BUCKET}:folder/`);
  });

  it('sets file folderId to bucket: when parentPath is undefined', () => {
    const result = normalizeFileItem(
      { nodeType: 'ITEM', url: 'file.pdf', name: 'file.pdf' },
      BUCKET,
    );
    expect(result.folderId).toBe(`${BUCKET}:`);
  });

  it('propagates bucket from caller', () => {
    const result = normalizeFileItem(
      { nodeType: 'ITEM', url: 'file.pdf', name: 'file.pdf', parentPath: '' },
      'custom-bucket',
    );
    expect(result.bucket).toBe('custom-bucket');
  });

  it('passes updatedAt through as number', () => {
    const result = normalizeFileItem(
      {
        nodeType: 'ITEM',
        url: 'file.pdf',
        name: 'file.pdf',
        updatedAt: 1710000000000,
      },
      BUCKET,
    );
    expect(result.updatedAt).toBe(1710000000000);
  });

  it('propagates contentLength and contentType for file items', () => {
    const result = normalizeFileItem(
      {
        nodeType: 'ITEM',
        url: 'folder/report.pdf',
        name: 'report.pdf',
        parentPath: 'folder/',
        contentLength: 12345,
        contentType: 'application/pdf',
      },
      BUCKET,
    );
    expect(result.contentLength).toBe(12345);
    expect(result.contentType).toBe('application/pdf');
  });
});
