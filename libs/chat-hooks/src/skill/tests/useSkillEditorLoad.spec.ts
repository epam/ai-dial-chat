import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SkillEditorLoadClient } from '../useSkillEditorLoad';
import {
  SkillEditorLoadState,
  useSkillEditorLoad,
} from '../useSkillEditorLoad';

const MANIFEST = [
  '---',
  'name: docs-helper',
  'description: Explains our docs',
  '---',
  '',
  'Use this skill to explain docs.',
].join('\n');

const makeResponse = (body: string, etag?: string): Response =>
  ({
    headers: { get: (name: string) => (name === 'etag' ? (etag ?? null) : null) },
    text: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(body).buffer),
  }) as unknown as Response;

/**
 * The archive route answers, but with no version tag. The per-file route is
 * healthy and would happily supply the manifest *file*'s tag — the exact
 * substitution that used to fill the form with something no save could use.
 */
const makeClient = (archiveEtag?: string): SkillEditorLoadClient => ({
  downloadSkill: vi.fn().mockResolvedValue(makeResponse('zip', archiveEtag)),
  downloadSkillFile: vi
    .fn()
    .mockResolvedValue(makeResponse(MANIFEST, '"manifest-file-etag"')),
  listSkillFiles: vi.fn().mockResolvedValue({
    items: [
      {
        name: 'SKILL.md',
        nodeType: 'item',
        parentPath: 'docs-helper/files',
        etag: '"manifest-file-etag"',
      },
    ],
  }),
});

const renderLoad = (client: SkillEditorLoadClient) =>
  renderHook(() =>
    useSkillEditorLoad({
      isEditMode: true,
      bucket: 'bucket-1',
      skillPath: 'docs-helper',
      client,
    }),
  );

describe('useSkillEditorLoad — missing version tag', () => {
  it('fails the load instead of falling back to the manifest file tag', async () => {
    const client = makeClient();
    const { result } = renderLoad(client);

    await waitFor(() =>
      expect(result.current.loadState).toBe(SkillEditorLoadState.Error),
    );

    expect(result.current.loadedValues).toBeUndefined();
    expect(result.current.etagRef.current).toBeUndefined();
    expect(client.listSkillFiles).not.toHaveBeenCalled();
  });

  it('loads normally when the archive carries its tag', async () => {
    const client: SkillEditorLoadClient = {
      ...makeClient('"skill-etag"'),
      downloadSkill: vi.fn().mockResolvedValue({
        headers: { get: () => '"skill-etag"' },
        arrayBuffer: () => Promise.reject(new Error('not a zip')),
      } as unknown as Response),
    };
    const { result } = renderLoad(client);

    /*
     * An unusable archive body is the compatibility case the per-file route
     * exists for, and it still recovers — only the missing tag does not.
     */
    await waitFor(() =>
      expect(result.current.loadState).toBe(SkillEditorLoadState.Loaded),
    );
    expect(result.current.loadedValues?.name).toBe('docs-helper');
    expect(result.current.etagRef.current).toBe('"manifest-file-etag"');
  });
});
