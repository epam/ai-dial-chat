import type { ExportFormat } from '@epam/ai-dial-chat-shared';
import { strFromU8, unzipSync } from 'fflate';
import {
  parseImportEnvelope,
  UnsupportedImportFormatError,
} from './import-conversation';
import { isValidArchivePath } from './zip-export';

/** New-chat archive conversation-JSON entry name, written at the archive root. */
const NEW_HISTORY_ENTRY_NAME = 'conversation.json';
/** Old-chat (`development` branch) archive conversation-JSON entry pattern. */
const OLD_HISTORY_ENTRY_REGEX = /^conversations\/.*\.json$/;
/** Attachment entries live under this prefix in both old and new archives. */
const ATTACHMENT_ENTRY_PREFIX = 'res/';

export interface ParsedDialArchive {
  /** The parsed and validated export envelope. */
  envelope: ExportFormat;
  /** Attachment bytes keyed by their bucket-relative path (the `res/<path>` suffix). */
  attachments: Map<string, Uint8Array>;
}

const findHistoryEntryName = (entryNames: string[]): string | undefined =>
  entryNames.find((name) => name === NEW_HISTORY_ENTRY_NAME) ??
  entryNames.find((name) => OLD_HISTORY_ENTRY_REGEX.test(name)) ??
  entryNames.find(
    (name) => !name.includes('/') && name.toLowerCase().endsWith('.json'),
  );

/*
 * `File.arrayBuffer()` is unavailable in some test environments (jsdom);
 * FileReader works consistently across both browsers and tests.
 */
const readFileAsBytes = (file: File): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });

/**
 * Parses a `.dial`/`.zip` archive produced by either the new-chat export
 * (`conversation.json` at the archive root) or the old (`development`
 * branch) export (`conversations/<name>.json`) — the JSON entry name is
 * detected tolerantly by its archive path, since both old-chat and new-chat
 * archives write the same `version: 5` envelope. Attachment bytes are
 * collected from `res/<path>` entries, keyed by their validated relative path.
 */
export const parseDialArchive = async (
  file: File,
): Promise<ParsedDialArchive> => {
  const buffer = await readFileAsBytes(file);

  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(buffer);
  } catch {
    throw new UnsupportedImportFormatError(
      'Import file is not a valid archive',
    );
  }

  const entryNames = Object.keys(entries);
  const historyEntryName = findHistoryEntryName(entryNames);
  if (!historyEntryName) {
    throw new UnsupportedImportFormatError(
      'Archive does not contain a readable conversation-JSON entry',
    );
  }

  const envelope = parseImportEnvelope(strFromU8(entries[historyEntryName]));

  const attachments = new Map<string, Uint8Array>();
  for (const name of entryNames) {
    if (name.endsWith('/') || !name.startsWith(ATTACHMENT_ENTRY_PREFIX)) {
      continue;
    }
    const path = name.slice(ATTACHMENT_ENTRY_PREFIX.length);
    if (!path || !isValidArchivePath(path)) continue;
    attachments.set(path, entries[name]);
  }

  return { envelope, attachments };
};
