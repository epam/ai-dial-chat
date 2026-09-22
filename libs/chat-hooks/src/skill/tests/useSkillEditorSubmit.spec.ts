import type { SkillEditorValues } from '@epam/ai-dial-skill-editor';
import { act, renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillFileContent } from '../skill-file-preview';
import type {
  SkillEditorSubmitClient,
  SkillEditorSubmitMessages,
  UseSkillEditorSubmitParams,
} from '../useSkillEditorSubmit';
import { useSkillEditorSubmit } from '../useSkillEditorSubmit';

const PASTED_MANIFEST = [
  '---',
  'name: pdf',
  'display_name: PDF Tools',
  'description: Work with PDF files',
  '---',
  '',
  '# PDF Tools',
].join('\n');

const messages: SkillEditorSubmitMessages = {
  required: 'This field is required',
  instructionsFrontmatter: 'Front matter belongs in the fields above',
  nameInvalid: 'Invalid name',
  nameConflict: 'Name already taken',
  archiveTooLarge: 'Too large',
  serviceUnavailable: 'Unavailable',
  pathInvalid: 'Invalid path',
  saveError: 'Save failed',
  saveSuccessTitle: 'Created',
  createSuccess: (name) => `Created ${name}`,
  updateSuccessTitle: 'Updated',
  updateSuccess: (name) => `Updated ${name}`,
  conflictMessage: 'Changed elsewhere',
};

const makeClient = (): SkillEditorSubmitClient => ({
  createSkill: vi.fn().mockResolvedValue({ etag: 'etag-2' }),
  updateSkill: vi.fn().mockResolvedValue({ etag: 'etag-2' }),
});

const makeValues = (
  overrides: Partial<SkillEditorValues> = {},
): SkillEditorValues => ({
  name: 'my-copy',
  description: 'My own description',
  instructions: '# My instructions',
  ...overrides,
});

interface Harness {
  client: SkillEditorSubmitClient;
  frontmatterRef: React.MutableRefObject<Record<string, unknown>>;
  params: UseSkillEditorSubmitParams;
}

const makeHarness = (isEditMode: boolean): Harness => {
  const client = makeClient();
  const frontmatterRef = createRef<
    Record<string, unknown>
  >() as React.MutableRefObject<Record<string, unknown>>;
  frontmatterRef.current = isEditMode
    ? { name: 'my-copy', description: 'Stored description', version: '1.2' }
    : {};

  const filesContentRef = createRef<
    Map<string, SkillFileContent>
  >() as React.MutableRefObject<Map<string, SkillFileContent>>;
  filesContentRef.current = new Map();

  const loadedPathRef = createRef<
    string | undefined
  >() as React.MutableRefObject<string | undefined>;
  loadedPathRef.current = isEditMode ? 'my-copy' : undefined;

  const etagRef = createRef<string | undefined>() as React.MutableRefObject<
    string | undefined
  >;
  etagRef.current = isEditMode ? 'etag-1' : undefined;

  return {
    client,
    frontmatterRef,
    params: {
      bucket: 'bucket-1',
      isEditMode,
      files: [],
      filesContentRef,
      frontmatterRef,
      loadedPathRef,
      etagRef,
      returnUrl: '/catalog',
      refetchSkills: vi.fn().mockResolvedValue(undefined),
      client,
      messages,
      onNavigate: vi.fn(),
      onNotify: vi.fn(),
    },
  };
};

describe('useSkillEditorSubmit front-matter guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks a create whose instructions open with a front-matter block', async () => {
    const { client, params } = makeHarness(false);
    const { result } = renderHook(() => useSkillEditorSubmit(params));

    await act(async () => {
      await result.current.handleSubmit(
        makeValues({ instructions: PASTED_MANIFEST }),
      );
    });

    expect(result.current.errors.instructions).toBe(
      messages.instructionsFrontmatter,
    );
    expect(client.createSkill).not.toHaveBeenCalled();
  });

  it('blocks an edit save and leaves the loaded frontmatter untouched', async () => {
    const { client, frontmatterRef, params } = makeHarness(true);
    const { result } = renderHook(() => useSkillEditorSubmit(params));

    await act(async () => {
      await result.current.handleSubmit(
        makeValues({ instructions: PASTED_MANIFEST }),
      );
    });

    expect(result.current.errors.instructions).toBe(
      messages.instructionsFrontmatter,
    );
    expect(client.updateSkill).not.toHaveBeenCalled();
    expect(frontmatterRef.current).toEqual({
      name: 'my-copy',
      description: 'Stored description',
      version: '1.2',
    });
  });

  it('builds a manifest with exactly one front-matter block for a clean body', async () => {
    const { client, params } = makeHarness(false);
    const { result } = renderHook(() => useSkillEditorSubmit(params));

    await act(async () => {
      await result.current.handleSubmit(makeValues());
    });

    expect(client.createSkill).toHaveBeenCalledOnce();
    const manifest = vi.mocked(client.createSkill).mock.calls[0][2];
    expect(manifest.indexOf('---')).toBe(0);
    expect(manifest.split(/^---[ \t]*$/m)).toHaveLength(3);
  });

  it('prefers the required-field message over the front-matter message', async () => {
    const { client, params } = makeHarness(false);
    const { result } = renderHook(() => useSkillEditorSubmit(params));

    await act(async () => {
      await result.current.handleSubmit(makeValues({ instructions: '   ' }));
    });

    expect(result.current.errors.instructions).toBe(messages.required);
    expect(client.createSkill).not.toHaveBeenCalled();
  });

  it('lets a body containing a later horizontal rule through', async () => {
    const { client, params } = makeHarness(false);
    const { result } = renderHook(() => useSkillEditorSubmit(params));

    await act(async () => {
      await result.current.handleSubmit(
        makeValues({ instructions: '# Heading\n\nProse.\n\n---\n\nMore.' }),
      );
    });

    expect(result.current.errors.instructions).toBeUndefined();
    expect(client.createSkill).toHaveBeenCalledOnce();
  });
});
