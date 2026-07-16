import type { ExportFormatV5 } from '@epam/ai-dial-chat-shared';
import { strToU8, zipSync } from 'fflate';

/** Character allowlist for attachment paths written into a `.dial` archive. */
const ARCHIVE_PATH_CHARSET = /^[a-zA-Z0-9._\-/]+$/;
/*
 * fflate identifies file entries with instanceof against its own Uint8Array
 * constructor, so normalize bytes from other realms before calling zipSync.
 */
const FflateUint8Array = strToU8('', true).constructor as Uint8ArrayConstructor;

const toZipUint8Array = (data: Uint8Array): Uint8Array =>
  data instanceof FflateUint8Array ? data : new FflateUint8Array(data);

/**
 * Validates an attachment path before it is written into a `.dial` archive.
 * The character allowlist alone does not stop traversal — `.` and `/` are both
 * permitted characters, so `../../etc/passwd` matches it. Path segments are
 * additionally rejected when empty (leading/trailing/double slash) or equal
 * to `.`/`..`, which blocks traversal and absolute paths.
 */
export const isValidArchivePath = (path: string): boolean => {
  if (!ARCHIVE_PATH_CHARSET.test(path)) return false;
  return path
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');
};

/** A single attachment already fetched into memory, ready to be written into the archive. */
export interface ZipAttachmentEntry {
  /** Relative path under which the attachment is stored, e.g. `reports/q1.pdf`. */
  path: string;
  /** Attachment content. */
  data: Uint8Array;
}

export interface BuildDialArchiveResult {
  /** The built `.dial` archive. */
  blob: Blob;
  /** Attachment paths that failed validation and were not written to the archive. */
  skippedPaths: string[];
}

/**
 * Builds a `.dial` ZIP archive containing the conversation export envelope
 * plus every valid attachment, laid out under `res/<path>`. Attachments
 * failing the path allowlist are skipped and reported in `skippedPaths`.
 */
export const buildDialArchive = (
  envelope: ExportFormatV5,
  attachments: ZipAttachmentEntry[],
): BuildDialArchiveResult => {
  const skippedPaths: string[] = [];
  const files: Record<string, Uint8Array> = {
    'conversation.json': toZipUint8Array(
      strToU8(JSON.stringify(envelope, null, 2)),
    ),
  };

  for (const attachment of attachments) {
    if (!isValidArchivePath(attachment.path)) {
      skippedPaths.push(attachment.path);
      continue;
    }
    files[`res/${attachment.path}`] = toZipUint8Array(attachment.data);
  }

  const zipped = zipSync(files);
  return {
    blob: new Blob([new Uint8Array(zipped)], { type: 'application/zip' }),
    skippedPaths,
  };
};
