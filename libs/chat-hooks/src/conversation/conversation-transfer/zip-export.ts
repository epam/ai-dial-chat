import type { ExportFormat } from '@epam/ai-dial-chat-shared';

/*
 * fflate is imported on demand, not at module scope: this module sits in the
 * `@epam/ai-dial-chat-hooks` barrel every page loads, and the ZIP engine is
 * needed only once a user exports.
 */

/*
 * fflate identifies file entries with instanceof against its own Uint8Array
 * constructor, so normalize bytes from other realms before calling zipSync.
 */
const toZipUint8Array = (
  data: Uint8Array,
  fflateUint8Array: Uint8ArrayConstructor,
): Uint8Array =>
  data instanceof fflateUint8Array ? data : new fflateUint8Array(data);

/**
 * Validates an attachment path before it is written into (or read from) a
 * `.dial` archive. Blocks path traversal and absolute paths by rejecting
 * empty, `.`, or `..` path segments (so `../../etc/passwd` and `/etc/passwd`
 * are both rejected). No character allowlist — real-world filenames
 * routinely contain spaces, parentheses, and non-ASCII characters, and any
 * character that would be unsafe in the eventual upload URL is already
 * percent-encoded downstream by `buildUploadPath`.
 */
export const isValidArchivePath = (path: string): boolean =>
  path.length > 0 &&
  path
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..');

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
export const buildDialArchive = async (
  envelope: ExportFormat,
  attachments: ZipAttachmentEntry[],
): Promise<BuildDialArchiveResult> => {
  const { strToU8, zipSync } = await import('fflate');
  const fflateUint8Array = strToU8('', true)
    .constructor as Uint8ArrayConstructor;
  const skippedPaths: string[] = [];
  const files: Record<string, Uint8Array> = {
    'conversation.json': toZipUint8Array(
      strToU8(JSON.stringify(envelope, null, 2)),
      fflateUint8Array,
    ),
  };

  for (const attachment of attachments) {
    if (!isValidArchivePath(attachment.path)) {
      skippedPaths.push(attachment.path);
      continue;
    }
    files[`res/${attachment.path}`] = toZipUint8Array(
      attachment.data,
      fflateUint8Array,
    );
  }

  const zipped = zipSync(files);
  return {
    blob: new Blob([new Uint8Array(zipped)], { type: 'application/zip' }),
    skippedPaths,
  };
};
