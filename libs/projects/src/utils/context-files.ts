import {
  type Attachment,
  getAttachmentTypeFromMime,
  inferMimeTypeFromPath,
  RequestStatus,
} from '@epam/ai-dial-chat-shared';
import type {
  ProjectContextFile,
  StoredProjectContextFile,
} from '../models/project-context-file';
import { ContextFileRejection } from '../types/context-file-rejection';
import { validateProjectName } from './project-name';

/** Limits a batch of incoming context files is checked against. */
export interface ContextFileLimits {
  /** Lower-case extensions, without a dot. */
  allowedExtensions: string[];
  /** Maximum size of one file, in bytes. */
  maxFileBytes: number;
  /** Maximum combined size of all context files, in bytes. */
  maxTotalBytes: number;
}

/** One rejected incoming file. */
export interface RejectedContextFile {
  name: string;
  reason: ContextFileRejection;
}

/** Result of {@link checkContextFiles}. */
export interface ContextFileCheck {
  /** Files to append, already shaped as staged attachments. */
  accepted: Attachment[];
  /** Files that were not added, in input order. */
  rejected: RejectedContextFile[];
}

/** Lower-case extension of `name`, or `''` when it has none. */
const getFileExtension = (name: string): string => {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
};

/** Whether a context file is already stored in the project rather than newly added. */
export const isStoredContextFile = (
  file: ProjectContextFile,
): file is StoredProjectContextFile => 'isStored' in file && file.isStored;

/** Size of one context file in bytes: the stored size, or the added `File`'s size. */
const getContextFileSize = (file: ProjectContextFile): number =>
  isStoredContextFile(file) ? file.size : file.file.size;

/** Sum of the sizes of every context file, stored or newly added, in bytes. */
export const getContextFilesSize = (files: ProjectContextFile[]): number =>
  files.reduce((total, file) => total + getContextFileSize(file), 0);

let nextContextFileId = 0;
const createContextFileId = (): string => {
  nextContextFileId += 1;
  return `project-context-${Date.now()}-${nextContextFileId}`;
};

const toAttachment = (file: File): Attachment => {
  const contentType =
    file.type || inferMimeTypeFromPath(file.name) || 'application/octet-stream';
  return {
    id: createContextFileId(),
    name: file.name,
    contentType,
    type: getAttachmentTypeFromMime(contentType),
    status: RequestStatus.Idle,
    file,
  };
};

const getRejection = (
  file: File,
  takenNames: Set<string>,
  runningTotal: number,
  limits: ContextFileLimits,
): ContextFileRejection | null => {
  if (
    validateProjectName(file.name) != null ||
    file.name.trim() !== file.name
  ) {
    return ContextFileRejection.InvalidName;
  }
  if (!limits.allowedExtensions.includes(getFileExtension(file.name))) {
    return ContextFileRejection.UnsupportedType;
  }
  if (takenNames.has(file.name)) return ContextFileRejection.Duplicate;
  if (file.size > limits.maxFileBytes) return ContextFileRejection.TooLarge;
  if (runningTotal + file.size > limits.maxTotalBytes) {
    return ContextFileRejection.CapacityExceeded;
  }
  return null;
};

/**
 * Splits incoming files into those that can be added to `existing` and those
 * that cannot, with the same rules `POST /api/v1/projects` enforces: an
 * allowed extension, the per-file size, the running total against the
 * capacity, a unique name (against `existing` and earlier files in the same
 * batch), and a valid DIAL name. Pure — the caller appends `accepted`.
 */
export const checkContextFiles = (
  incoming: File[],
  existing: ProjectContextFile[],
  limits: ContextFileLimits,
): ContextFileCheck => {
  const takenNames = new Set(existing.map((attachment) => attachment.name));
  let runningTotal = getContextFilesSize(existing);
  const accepted: Attachment[] = [];
  const rejected: RejectedContextFile[] = [];

  for (const file of incoming) {
    const reason = getRejection(file, takenNames, runningTotal, limits);
    if (reason != null) {
      rejected.push({ name: file.name, reason });
      continue;
    }
    takenNames.add(file.name);
    runningTotal += file.size;
    accepted.push(toAttachment(file));
  }

  return { accepted, rejected };
};

/** Share of the capacity in use, as a whole percentage clamped to 0–100; any use below 1% reads as 1%. */
export const getCapacityPercent = (
  usedBytes: number,
  maxBytes: number,
): number => {
  if (usedBytes <= 0) return 0;
  if (maxBytes <= 0) return 100;
  /* Rounding a few KiB of a 10 MiB capacity down to 0% would show a meter
   * claiming nothing is used next to the files that use it. */
  return Math.min(100, Math.max(1, Math.round((usedBytes / maxBytes) * 100)));
};

/** Context files whose name contains the trimmed `query`, case-insensitively; every file for a blank query. */
export const filterContextFileItems = <T extends { name: string }>(
  files: T[],
  query: string,
): T[] => {
  const needle = query.trim().toLowerCase();
  if (needle === '') return files;
  return files.filter((file) => file.name.toLowerCase().includes(needle));
};
