import { IconFile, IconFileZip, IconJson } from '@tabler/icons-react';
import { describe, expect, it } from 'vitest';
import { getTransferFileIcon } from '../transfer-file';

describe('getTransferFileIcon', () => {
  it('returns the archive icon for a .dial name', () => {
    expect(getTransferFileIcon('2026-09-01_ai_dial_chat.dial')).toBe(
      IconFileZip,
    );
  });

  it('returns the archive icon for a .zip name', () => {
    expect(getTransferFileIcon('backup.zip')).toBe(IconFileZip);
  });

  it('returns the JSON icon for a .json name', () => {
    expect(getTransferFileIcon('history.json')).toBe(IconJson);
  });

  it('matches the extension case-insensitively', () => {
    expect(getTransferFileIcon('BACKUP.DIAL')).toBe(IconFileZip);
    expect(getTransferFileIcon('History.JSON')).toBe(IconJson);
  });

  it('falls back to the generic file icon for anything else', () => {
    expect(getTransferFileIcon('archive.tar.gz')).toBe(IconFile);
    expect(getTransferFileIcon('no-extension')).toBe(IconFile);
    expect(getTransferFileIcon('')).toBe(IconFile);
  });

  it('does not match an extension appearing mid-name', () => {
    expect(getTransferFileIcon('my.dial.notes.txt')).toBe(IconFile);
  });
});
