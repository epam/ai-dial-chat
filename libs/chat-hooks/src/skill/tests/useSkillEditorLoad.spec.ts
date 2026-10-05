import { SkillFileNodeKind } from '@epam/ai-dial-skill-editor';
import { renderHook, waitFor } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
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
    headers: {
      get: (name: string) => (name === 'etag' ? (etag ?? null) : null),
    },
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

describe('useSkillEditorLoad — empty-folder markers', () => {
  it('restores a marked folder from the archive without loading the marker', async () => {
    const zipped = zipSync({
      'SKILL.md': strToU8(MANIFEST),
      'docs/.dial_folder': new Uint8Array(0),
    });
    const client: SkillEditorLoadClient = {
      ...makeClient(),
      downloadSkill: vi.fn().mockResolvedValue({
        headers: { get: () => '"skill-etag"' },
        arrayBuffer: () => Promise.resolve(zipped.buffer),
      } as unknown as Response),
    };
    const { result } = renderLoad(client);

    await waitFor(() =>
      expect(result.current.loadState).toBe(SkillEditorLoadState.Loaded),
    );
    expect(result.current.files).toEqual([
      { path: 'docs', name: 'docs', kind: SkillFileNodeKind.Folder },
    ]);
    expect(result.current.filesContentRef.current.size).toBe(0);
  });

  it('restores a marked folder from the listing without downloading the marker', async () => {
    const client: SkillEditorLoadClient = {
      downloadSkill: vi.fn().mockResolvedValue({
        headers: { get: () => '"skill-etag"' },
        arrayBuffer: () => Promise.reject(new Error('not a zip')),
      } as unknown as Response),
      downloadSkillFile: vi
        .fn()
        .mockResolvedValue(makeResponse(MANIFEST, '"manifest-file-etag"')),
      listSkillFiles: vi.fn().mockResolvedValue({
        items: [
          {
            name: 'SKILL.md',
            nodeType: 'item',
            parentPath: 'docs-helper/files',
          },
          {
            name: '.dial_folder',
            nodeType: 'item',
            parentPath: 'docs-helper/files/docs',
          },
        ],
      }),
    };
    const { result } = renderLoad(client);

    await waitFor(() =>
      expect(result.current.loadState).toBe(SkillEditorLoadState.Loaded),
    );
    expect(result.current.files).toEqual([
      { path: 'docs', name: 'docs', kind: SkillFileNodeKind.Folder },
    ]);
    expect(client.downloadSkillFile).toHaveBeenCalledOnce();
    expect(client.downloadSkillFile).toHaveBeenCalledWith(
      'bucket-1',
      'docs-helper',
      'SKILL.md',
    );
  });
});
