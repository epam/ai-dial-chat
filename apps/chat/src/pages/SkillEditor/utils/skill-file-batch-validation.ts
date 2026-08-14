import {
  SkillFileCandidateKind,
  SkillFileValidationStatus,
  type SkillFileBatchError,
  type SkillFileUploadCandidate,
  type SkillFileValidationResult,
} from '@epam/ai-dial-skill-editor';
import {
  isValidSkillRelativePath,
  parseSkillManifest,
  SKILL_FILE_UPLOAD_MAX_BYTES,
  SKILL_MANIFEST_FILE,
  SKILL_UPLOAD_MAX_FILES,
  SKILL_UPLOAD_MAX_TOTAL_BYTES,
} from '../../../utils/skill';

/** A recognized, structurally valid manifest candidate from a staged batch. */
export interface SkillManifestImportCandidate {
  /** The `SkillFileUploadCandidate.id` this manifest came from. */
  candidateId: string;
  /** The imported manifest's `name` field. */
  name: string;
  /** The imported manifest's `description` field. */
  description: string;
  /** The imported manifest's full parsed frontmatter, including unknown fields. */
  frontmatter: Record<string, unknown>;
  /** The imported manifest's instructions body. */
  instructions: string;
}

/** Localized messages the batch validator needs, resolved by the caller. */
export interface SkillFileBatchValidationMessages {
  required: string;
  pathReserved: string;
  pathInvalid: string;
  pathDuplicate: string;
  fileTooLarge: (maxSize: string) => string;
  manifestCasingInvalid: string;
  manifestDuplicate: string;
  manifestInvalidUtf8: string;
  manifestInvalidFrontmatter: string;
  totalSizeExceeded: string;
  totalCountExceeded: string;
}

/** Snapshot of editor state the batch validator projects new totals against. */
export interface SkillFileBatchValidationContext {
  /** Paths already present in the editor's supporting-file tree. */
  existingPaths: string[];
  /** Sum of the bytes already held for existing supporting files. */
  existingTotalBytes: number;
  /** UTF-8 byte length of the currently generated/loaded root `SKILL.md`. */
  manifestByteLength: number;
  /** Localized messages. */
  messages: SkillFileBatchValidationMessages;
}

/** Result of validating a whole staged batch. */
export interface SkillFileBatchValidationOutcome {
  /** One result per candidate, in the same order as the input. */
  results: SkillFileValidationResult[];
  /** Batch-level errors (projected total size/count, multiple manifests). */
  batchErrors: SkillFileBatchError[];
  /** The single accepted manifest import, when the batch has exactly one valid `SKILL.md`. */
  manifestCandidate?: SkillManifestImportCandidate;
}

const formatBytesForMessage = (bytes: number): string => {
  const KB = 1024;
  const MB = KB * 1024;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${bytes} B`;
};

/**
 * Validates a whole staged upload batch against per-file limits, path
 * safety, in-batch/against-existing duplicates, and projected total
 * size/count — mirroring the BFF's authoritative `SkillsPackageService`
 * limits for immediate feedback (the server remains the final gate). Reads
 * each candidate's bytes only where required (the root `SKILL.md` manifest,
 * to decode and parse its frontmatter) — never for an ordinary supporting
 * file, whose size is checked via `File.size` alone.
 */
export const validateSkillFileBatch = async (
  candidates: SkillFileUploadCandidate[],
  context: SkillFileBatchValidationContext,
): Promise<SkillFileBatchValidationOutcome> => {
  const { existingPaths, existingTotalBytes, manifestByteLength, messages } =
    context;
  const results: SkillFileValidationResult[] = [];
  const batchErrors: SkillFileBatchError[] = [];
  const existingPathSet = new Set(existingPaths);

  // Count occurrences of each supporting-file path up front, so every
  // candidate sharing a duplicated path is marked invalid — not just the
  // second (and later) occurrences.
  const pathOccurrences = new Map<string, number>();
  for (const { path } of candidates) {
    if (path === SKILL_MANIFEST_FILE) continue;
    pathOccurrences.set(path, (pathOccurrences.get(path) ?? 0) + 1);
  }

  let stagedSupportingBytes = 0;
  const countedSupportingPaths = new Set<string>();
  let manifestCandidate: SkillManifestImportCandidate | undefined;
  let manifestFileSize = manifestByteLength;
  let manifestCandidateCount = 0;

  for (const candidate of candidates) {
    const { id, file, path } = candidate;
    let error: string | undefined;
    let kind = SkillFileCandidateKind.SupportingFile;

    const isRootManifestCasingVariant =
      path.toLowerCase() === SKILL_MANIFEST_FILE.toLowerCase() &&
      path !== SKILL_MANIFEST_FILE;

    if (isRootManifestCasingVariant) {
      error = messages.manifestCasingInvalid;
    } else if (path === SKILL_MANIFEST_FILE) {
      kind = SkillFileCandidateKind.Manifest;
      manifestCandidateCount += 1;
      if (file.size > SKILL_FILE_UPLOAD_MAX_BYTES) {
        error = messages.fileTooLarge(
          formatBytesForMessage(SKILL_FILE_UPLOAD_MAX_BYTES),
        );
      } else {
        try {
          const text = await file.text();
          if (text.includes('�')) {
            error = messages.manifestInvalidUtf8;
          } else {
            const { frontmatter, instructions } = parseSkillManifest(text);
            const name =
              typeof frontmatter.name === 'string' ? frontmatter.name : '';
            const description =
              typeof frontmatter.description === 'string'
                ? frontmatter.description
                : '';
            if (!name.trim() || !description.trim()) {
              error = messages.manifestInvalidFrontmatter;
            } else if (manifestCandidateCount === 1) {
              manifestCandidate = {
                candidateId: id,
                name,
                description,
                frontmatter,
                instructions,
              };
              manifestFileSize = file.size;
            }
          }
        } catch {
          error = messages.manifestInvalidFrontmatter;
        }
      }
    } else if (!path) {
      error = messages.required;
    } else if (!isValidSkillRelativePath(path)) {
      error = messages.pathInvalid;
    } else if (
      existingPathSet.has(path) ||
      (pathOccurrences.get(path) ?? 0) > 1
    ) {
      error = messages.pathDuplicate;
    } else if (file.size > SKILL_FILE_UPLOAD_MAX_BYTES) {
      error = messages.fileTooLarge(
        formatBytesForMessage(SKILL_FILE_UPLOAD_MAX_BYTES),
      );
    }

    if (!error && kind === SkillFileCandidateKind.SupportingFile) {
      countedSupportingPaths.add(path);
      stagedSupportingBytes += file.size;
    }

    results.push({
      candidateId: id,
      status: error
        ? SkillFileValidationStatus.Invalid
        : SkillFileValidationStatus.Valid,
      kind,
      error,
    });
  }

  if (manifestCandidateCount > 1) {
    batchErrors.push({ message: messages.manifestDuplicate });
    manifestCandidate = undefined;
    manifestFileSize = manifestByteLength;
    for (const result of results) {
      if (result.kind === SkillFileCandidateKind.Manifest && !result.error) {
        result.status = SkillFileValidationStatus.Invalid;
        result.error = messages.manifestDuplicate;
      }
    }
  }

  const projectedTotalBytes =
    existingTotalBytes + stagedSupportingBytes + manifestFileSize;
  if (projectedTotalBytes > SKILL_UPLOAD_MAX_TOTAL_BYTES) {
    batchErrors.push({ message: messages.totalSizeExceeded });
  }

  const projectedTotalFiles =
    existingPathSet.size + countedSupportingPaths.size + 1;
  if (projectedTotalFiles > SKILL_UPLOAD_MAX_FILES) {
    batchErrors.push({ message: messages.totalCountExceeded });
  }

  return { results, batchErrors, manifestCandidate };
};
