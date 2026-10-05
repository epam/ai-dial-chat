import { inferMimeTypeFromPath } from '@epam/ai-dial-chat-shared';
import type { SkillFileSourceEntry } from '@epam/ai-dial-skill-editor';
import { unzipSync } from 'fflate';
import { nameFromPath, SKILL_FOLDER_MARKER } from './skill';

/** Archive metadata written by macOS Finder, never part of a skill. */
const MAC_METADATA_PREFIX = '__MACOSX/';
const MAC_FOLDER_INFO_NAME = '.DS_Store';

// An empty-folder marker is DIAL storage metadata, not a file to stage.
const isSkippedEntry = (path: string): boolean =>
  path.endsWith('/') ||
  path.startsWith(MAC_METADATA_PREFIX) ||
  nameFromPath(path) === MAC_FOLDER_INFO_NAME ||
  nameFromPath(path) === SKILL_FOLDER_MARKER;

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
 * Expands a `.zip` into one entry per file, with `/`-separated paths as stored
 * in the archive; rejects when the input is not a readable zip.
 */
export const extractSkillArchive = async (
  archive: File,
): Promise<SkillFileSourceEntry[]> => {
  const entries = unzipSync(await readFileAsBytes(archive));
  /*
   * Path safety, size and count are deliberately not checked here: every
   * entry is staged and goes through the same batch validation as a device
   * upload, which renders its error on the entry's own row.
   */
  return Object.entries(entries).flatMap(([rawPath, bytes]) => {
    const path = rawPath.replace(/\\/g, '/');
    if (isSkippedEntry(path)) return [];
    return [
      {
        path,
        file: new File([bytes as BlobPart], nameFromPath(path), {
          type: inferMimeTypeFromPath(path) ?? '',
        }),
      },
    ];
  });
};
