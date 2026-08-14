import {
  SkillFileCandidateKind,
  SkillFileValidationStatus,
  type SkillFileUploadCandidate,
} from '@epam/ai-dial-skill-editor';
import { describe, expect, it } from 'vitest';
import {
  SKILL_FILE_UPLOAD_MAX_BYTES,
  SKILL_UPLOAD_MAX_FILES,
  SKILL_UPLOAD_MAX_TOTAL_BYTES,
} from '../../../../utils/skill';
import type { SkillFileBatchValidationMessages } from '../../models/skill-file-batch-validation';
import { validateSkillFileBatch } from '../skill-file-batch-validation';

const messages: SkillFileBatchValidationMessages = {
  required: 'Required',
  pathReserved: 'Reserved',
  pathInvalid: 'Invalid path',
  pathDuplicate: 'Duplicate path',
  fileTooLarge: (maxSize) => `Too large (max ${maxSize})`,
  manifestCasingInvalid: 'Must be exactly SKILL.md',
  manifestDuplicate: 'Only one SKILL.md allowed',
  manifestInvalidUtf8: 'Invalid UTF-8',
  manifestInvalidFrontmatter: 'Invalid frontmatter',
  totalSizeExceeded: 'Total size exceeded',
  totalCountExceeded: 'Total count exceeded',
};

let candidateSeq = 0;
const buildCandidate = (
  path: string,
  content: BlobPart = 'content',
): SkillFileUploadCandidate => ({
  id: `candidate-${++candidateSeq}`,
  file: new File([content], path.split('/').pop() ?? path),
  path,
});

const baseContext = {
  existingPaths: [] as string[],
  existingTotalBytes: 0,
  manifestByteLength: 100,
  messages,
};

const validManifestText =
  '---\nname: good-morning\ndescription: A greeting skill\n---\n\nDo the thing.';

describe('validateSkillFileBatch', () => {
  it('accepts a plain valid supporting file', async () => {
    const candidate = buildCandidate('notes.md');
    const { results, batchErrors } = await validateSkillFileBatch(
      [candidate],
      baseContext,
    );

    expect(results[0].status).toBe(SkillFileValidationStatus.Valid);
    expect(results[0].kind).toBe(SkillFileCandidateKind.SupportingFile);
    expect(batchErrors).toHaveLength(0);
  });

  it('rejects a file exceeding the per-file size limit before reading bytes', async () => {
    const oversized = new Uint8Array(SKILL_FILE_UPLOAD_MAX_BYTES + 1);
    const candidate = buildCandidate('big.md', oversized);
    const { results } = await validateSkillFileBatch([candidate], baseContext);

    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[0].error).toContain('Too large');
  });

  it('rejects an invalid or unsafe path', async () => {
    const candidate = buildCandidate('../escape.md');
    const { results } = await validateSkillFileBatch([candidate], baseContext);

    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[0].error).toBe(messages.pathInvalid);
  });

  it('rejects duplicate paths within the staged batch', async () => {
    const a = buildCandidate('notes.md');
    const b = buildCandidate('notes.md');
    const { results } = await validateSkillFileBatch([a, b], baseContext);

    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[1].status).toBe(SkillFileValidationStatus.Invalid);
  });

  it('rejects a path duplicating an existing file', async () => {
    const candidate = buildCandidate('notes.md');
    const { results } = await validateSkillFileBatch([candidate], {
      ...baseContext,
      existingPaths: ['notes.md'],
    });

    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[0].error).toBe(messages.pathDuplicate);
  });

  it('rejects the whole batch when projected total size exceeds the limit', async () => {
    const candidate = buildCandidate('big.md');
    const { batchErrors } = await validateSkillFileBatch([candidate], {
      ...baseContext,
      existingTotalBytes: SKILL_UPLOAD_MAX_TOTAL_BYTES,
    });

    expect(batchErrors).toContainEqual({ message: messages.totalSizeExceeded });
  });

  it('rejects the whole batch when projected total file count exceeds the limit', async () => {
    const candidate = buildCandidate('extra.md');
    const existingPaths = Array.from(
      { length: SKILL_UPLOAD_MAX_FILES - 1 },
      (_, i) => `file-${i}.md`,
    );
    const { batchErrors } = await validateSkillFileBatch([candidate], {
      ...baseContext,
      existingPaths,
    });

    expect(batchErrors).toContainEqual({
      message: messages.totalCountExceeded,
    });
  });

  it('recognizes a valid root SKILL.md as a manifest candidate', async () => {
    const candidate = buildCandidate('SKILL.md', validManifestText);
    const { results, manifestCandidate } = await validateSkillFileBatch(
      [candidate],
      baseContext,
    );

    expect(results[0].status).toBe(SkillFileValidationStatus.Valid);
    expect(results[0].kind).toBe(SkillFileCandidateKind.Manifest);
    expect(manifestCandidate).toMatchObject({
      name: 'good-morning',
      description: 'A greeting skill',
    });
  });

  it('rejects a batch with more than one root SKILL.md', async () => {
    const a = buildCandidate('SKILL.md', validManifestText);
    const b = buildCandidate('SKILL.md', validManifestText);
    const { results, batchErrors, manifestCandidate } =
      await validateSkillFileBatch([a, b], baseContext);

    expect(batchErrors).toContainEqual({ message: messages.manifestDuplicate });
    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[1].status).toBe(SkillFileValidationStatus.Invalid);
    expect(manifestCandidate).toBeUndefined();
  });

  it('treats a nested docs/SKILL.md as an ordinary supporting file', async () => {
    const candidate = buildCandidate('docs/SKILL.md', validManifestText);
    const { results, manifestCandidate } = await validateSkillFileBatch(
      [candidate],
      baseContext,
    );

    expect(results[0].kind).toBe(SkillFileCandidateKind.SupportingFile);
    expect(results[0].status).toBe(SkillFileValidationStatus.Valid);
    expect(manifestCandidate).toBeUndefined();
  });

  it('rejects a root case-variant filename with a casing-specific message', async () => {
    const candidate = buildCandidate('skill.md', validManifestText);
    const { results, manifestCandidate } = await validateSkillFileBatch(
      [candidate],
      baseContext,
    );

    expect(results[0].kind).toBe(SkillFileCandidateKind.SupportingFile);
    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[0].error).toBe(messages.manifestCasingInvalid);
    expect(manifestCandidate).toBeUndefined();
  });

  it('rejects invalid UTF-8 content in SKILL.md', async () => {
    const invalidUtf8 = new Uint8Array([0xff, 0xfe, 0xfd]);
    const candidate = buildCandidate('SKILL.md', invalidUtf8);
    const { results } = await validateSkillFileBatch([candidate], baseContext);

    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[0].error).toBe(messages.manifestInvalidUtf8);
  });

  it('rejects SKILL.md with invalid/missing YAML frontmatter', async () => {
    const candidate = buildCandidate('SKILL.md', 'not a manifest at all');
    const { results } = await validateSkillFileBatch([candidate], baseContext);

    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[0].error).toBe(messages.manifestInvalidFrontmatter);
  });

  it('rejects SKILL.md whose frontmatter is missing name or description', async () => {
    const candidate = buildCandidate(
      'SKILL.md',
      '---\nname: good-morning\n---\n\nBody',
    );
    const { results } = await validateSkillFileBatch([candidate], baseContext);

    expect(results[0].status).toBe(SkillFileValidationStatus.Invalid);
    expect(results[0].error).toBe(messages.manifestInvalidFrontmatter);
  });
});
