import { formatDateYM } from './date';
import { splitFileNameExtension } from './file-name';

export const getSafeFileName = (fileName: string): string => {
  const name = fileName.split(/[\\/]/).filter(Boolean).pop() ?? 'file';
  return name.replace(/\.\.+/g, '.').replace(/^\.+/, '') || 'file';
};

/**
 * Builds the `uploads/<YYYY-MM>/<safe-name>` upload path for a file.
 * `date` defaults to now (regular attachment upload); conversation import
 * passes a date fixed for the whole job so all its attachments land in the
 * same month folder. Does not de-duplicate: a name collision is left for the
 * upload call to reject (`create-only` mode) — use `createUploadPathAllocator`
 * when collisions must be resolved with a ` (n)` suffix instead.
 */
export const buildUploadPath = (
  fileName: string,
  date: Date = new Date(),
): string => {
  const dateFolder = formatDateYM(date);
  const encodedFileName = encodeURIComponent(getSafeFileName(fileName));
  return `uploads/${dateFolder}/${encodedFileName}`;
};

/** Inserts a ` (n)` disambiguation suffix before the extension; `index` of 0 means no suffix. */
const buildIndexedFileName = (
  base: string,
  extension: string,
  index: number,
): string =>
  index === 0 ? `${base}${extension}` : `${base} (${index})${extension}`;

/** A file name the allocator has handed out, in the forms the caller needs. */
export interface AllocatedUploadPath {
  /** Bucket-relative, percent-encoded upload path, e.g. `uploads/2026-08/report%20(1).pdf`. */
  path: string;
  /** Decoded name actually reserved, e.g. `report (1).pdf` — pass this as the uploaded `File`'s name. */
  fileName: string;
  /** Whether a ` (n)` suffix had to be appended because the requested name was taken. */
  isRenamed: boolean;
}

/** Stateful allocator that hands out collision-free upload paths inside one month folder. */
export interface UploadPathAllocator {
  /** Reserves the next free name derived from `fileName` and returns its upload path. */
  allocate: (fileName: string) => AllocatedUploadPath;
  /** Records `fileName` as taken — used when the server rejects a name the registry believed free. */
  markTaken: (fileName: string) => void;
}

/**
 * Creates an allocator that assigns ` (1)`, ` (2)`, … suffixes to repeated or
 * pre-existing file names so every allocation lands on a distinct path inside
 * one `uploads/<YYYY-MM>/` folder. Mutation is deliberately confined to the
 * private `Set` closed over here — an explicit, contained exception to the
 * immutable-by-default rule, needed because collision-free naming is
 * inherently a sequential, stateful decision.
 */
export const createUploadPathAllocator = (params?: {
  /** Month folder to allocate into. Defaults to now. */
  date?: Date;
  /** Decoded names already present in the destination folder, e.g. from `listFiles`. */
  existingNames?: Iterable<string>;
}): UploadPathAllocator => {
  const date = params?.date ?? new Date();
  const takenNames = new Set<string>(params?.existingNames);

  const allocate = (fileName: string): AllocatedUploadPath => {
    const safeName = getSafeFileName(fileName);
    const { base, extension } = splitFileNameExtension(safeName);

    let index = 0;
    let candidate = buildIndexedFileName(base, extension, index);
    while (takenNames.has(candidate)) {
      index += 1;
      candidate = buildIndexedFileName(base, extension, index);
    }

    takenNames.add(candidate);
    return {
      path: `uploads/${formatDateYM(date)}/${encodeURIComponent(candidate)}`,
      fileName: candidate,
      isRenamed: index > 0,
    };
  };

  const markTaken = (fileName: string): void => {
    takenNames.add(fileName);
  };

  return { allocate, markTaken };
};
