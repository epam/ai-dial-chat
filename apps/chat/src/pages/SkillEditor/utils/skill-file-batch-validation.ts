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
import { formatFileSize } from '../../../utils/string-utils';
import type {
  SkillFileBatchValidationContext,
  SkillFileBatchValidationOutcome,
  SkillManifestImportCandidate,
} from '../models/skill-file-batch-validation';

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
          formatFileSize(SKILL_FILE_UPLOAD_MAX_BYTES),
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
        formatFileSize(SKILL_FILE_UPLOAD_MAX_BYTES),
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
