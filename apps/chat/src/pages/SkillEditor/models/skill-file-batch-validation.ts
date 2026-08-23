import type {
  SkillFileBatchError,
  SkillFileValidationResult,
} from '@epam/ai-dial-skill-editor';

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
