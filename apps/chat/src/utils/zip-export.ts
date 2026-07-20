import type { ExportFormat } from '@epam/ai-dial-chat-shared';
import { strToU8, zipSync } from 'fflate';

/*
 * fflate identifies file entries with instanceof against its own Uint8Array
 * constructor, so normalize bytes from other realms before calling zipSync.
 */
const FflateUint8Array = strToU8('', true).constructor as Uint8ArrayConstructor;

const toZipUint8Array = (data: Uint8Array): Uint8Array =>
  data instanceof FflateUint8Array ? data : new FflateUint8Array(data);

/**
 * Validates an attachment path before it is written into (or read from) a
 * `.dial` archive. Blocks path traversal and absolute paths by rejecting
 * empty, `.`, or `..` path segments (so `../../etc/passwd` and `/etc/passwd`
 * are both rejected). No character allowlist — real-world filenames
 * routinely contain spaces, parentheses, and non-ASCII characters, and any
 * character that would be unsafe in the eventual upload URL is already
 * percent-encoded downstream by `buildImportUploadPath`/`buildUploadPath`.
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
export const buildDialArchive = (
  envelope: ExportFormat,
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
