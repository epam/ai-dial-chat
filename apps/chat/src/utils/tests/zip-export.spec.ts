import type { Conversation, ExportFormat } from '@epam/ai-dial-chat-shared';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildDialArchive, isValidArchivePath } from '../zip-export';

const makeConversation = (): Conversation => ({
  id: 'conv-1',
  folderId: 'root',
  name: 'My Chat',
  model: { id: 'gpt-4o' },
  prompt: '',
  temperature: 0.5,
  messages: [],
  lastActivityDate: 1000,
  updatedAt: 2000,
  selectedAddons: [],
  assistantModelId: 'gpt-4o',
});

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const readBlobAsBytes = (blob: Blob): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });

describe('isValidArchivePath', () => {
  it('accepts a simple nested path', () => {
    expect(isValidArchivePath('reports/2026/q1.pdf')).toBe(true);
  });

  it('rejects a path traversal attempt', () => {
    expect(isValidArchivePath('../../etc/passwd')).toBe(false);
  });

  it('accepts a path with spaces, parentheses, and unicode characters', () => {
    expect(isValidArchivePath('reports/q1 (final) — Résumé.pdf')).toBe(true);
  });

  it('rejects an absolute path', () => {
    expect(isValidArchivePath('/etc/passwd')).toBe(false);
  });

  it('rejects a path with a double slash', () => {
    expect(isValidArchivePath('reports//q1.pdf')).toBe(false);
  });

  it('accepts a filename with multiple dots', () => {
    expect(isValidArchivePath('reports/report.v2.final.pdf')).toBe(true);
  });
});

describe('buildDialArchive', () => {
  const envelope: ExportFormat = {
    version: 5,
    history: [makeConversation()],
    folders: [],
  };

  it('reports no skipped paths when all attachments are valid', () => {
    const result = buildDialArchive(envelope, [
      { path: 'reports/q1.pdf', data: encode('pdf-bytes') },
      { path: 'images/photo.png', data: encode('png-bytes') },
    ]);

    expect(result.skippedPaths).toEqual([]);
    expect(result.blob.type).toBe('application/zip');
  });

  it('produces a zip readable back with fflate', async () => {
    const result = buildDialArchive(envelope, [
      { path: 'reports/q1.pdf', data: encode('pdf-bytes') },
    ]);

    const buffer = await readBlobAsBytes(result.blob);
    const entries = unzipSync(buffer);

    expect(Object.keys(entries).sort()).toEqual([
      'conversation.json',
      'res/reports/q1.pdf',
    ]);
    expect(JSON.parse(strFromU8(entries['conversation.json']))).toEqual(
      envelope,
    );
    expect(strFromU8(entries['res/reports/q1.pdf'])).toBe('pdf-bytes');
  });

  it('skips attachments with an invalid path and does not write them', async () => {
    const result = buildDialArchive(envelope, [
      { path: '../../etc/passwd', data: encode('malicious') },
      { path: 'safe/file.txt', data: encode('safe-bytes') },
    ]);

    expect(result.skippedPaths).toEqual(['../../etc/passwd']);

    const buffer = await readBlobAsBytes(result.blob);
    const entries = unzipSync(buffer);
    expect(Object.keys(entries).sort()).toEqual([
      'conversation.json',
      'res/safe/file.txt',
    ]);
  });

  it('returns a zip Blob even when there are no attachments', async () => {
    const result = buildDialArchive(envelope, []);
    const buffer = await readBlobAsBytes(result.blob);
    const entries = unzipSync(buffer);
    expect(Object.keys(entries)).toEqual(['conversation.json']);
  });
});
