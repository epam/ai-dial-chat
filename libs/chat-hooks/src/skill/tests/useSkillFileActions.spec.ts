import {
  SkillFileNodeKind,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { SkillFileContent } from '../skill-file-preview';
import {
  useSkillFileActions,
  type SkillFileActionsMessages,
} from '../useSkillFileActions';

const messages: SkillFileActionsMessages = {
  required: 'required',
  pathReserved: 'reserved',
  pathInvalid: 'invalid',
  pathDuplicate: 'duplicate',
  fileTooLarge: () => 'too large',
  manifestCasingInvalid: 'casing',
  manifestDuplicate: 'manifest duplicate',
  manifestInvalidUtf8: 'utf8',
  manifestInvalidFrontmatter: 'frontmatter',
  totalSizeExceeded: 'total size',
  totalCountExceeded: 'total count',
  manifestNameMismatch: 'mismatch',
  manifestImportDeclined: 'declined',
  saveError: 'save error',
};

const renderActions = (
  initialFiles: SkillFileTreeNode[] = [],
  pickFromFileSystem?: () => Promise<undefined>,
) =>
  renderHook(() => {
    const [files, setFiles] = useState(initialFiles);
    const [, setSelectedPath] = useState('SKILL.md');
    const filesContentRef = useRef(new Map<string, SkillFileContent>());
    const frontmatterRef = useRef<Record<string, unknown>>({});
    const actions = useSkillFileActions({
      files,
      setFiles,
      filesContentRef,
      frontmatterRef,
      loadedValues: undefined,
      setLoadedValues: vi.fn(),
      isEditMode: false,
      isDirty: false,
      setSelectedPath,
      messages,
      pickFromFileSystem,
    });
    return { files, filesContentRef, ...actions };
  });

describe('useSkillFileActions', () => {
  it('overwrites the bytes of a replaced file without adding a second node', async () => {
    const existing = {
      path: 'notes.md',
      name: 'notes.md',
      kind: SkillFileNodeKind.File,
    };
    const { result } = renderActions([existing]);

    let commitResult: { error?: string } | undefined;
    await act(async () => {
      commitResult = await result.current.fileActions.commitBatch([
        {
          id: 'candidate-1',
          file: new File(['fresh'], 'notes.md'),
          path: 'notes.md',
          replacesExisting: true,
        },
      ]);
    });

    expect(commitResult).toEqual({});
    expect(result.current.files).toEqual([existing]);
    expect(result.current.contentRevisions).toEqual({ 'notes.md': 1 });
    expect(
      new TextDecoder().decode(
        result.current.filesContentRef.current.get('notes.md')?.bytes,
      ),
    ).toBe('fresh');
  });

  it('rejects a file uploaded at the path of an existing folder', async () => {
    const folder = {
      path: 'scripts',
      name: 'scripts',
      kind: SkillFileNodeKind.Folder,
    };
    const { result } = renderActions([folder]);

    const { results } = await result.current.fileActions.validateBatch([
      { id: 'candidate-1', file: new File(['x'], 'scripts'), path: 'scripts' },
    ]);

    expect(results[0].error).toBe(messages.pathDuplicate);
  });

  it('adds a created folder as a folder node', () => {
    const { result } = renderActions();

    act(() => result.current.fileActions.onCreateFolder?.('docs/img'));

    expect(result.current.files).toEqual([
      { path: 'docs/img', name: 'img', kind: SkillFileNodeKind.Folder },
    ]);
  });

  it('ignores a created folder whose path already exists', () => {
    const existing = {
      path: 'docs',
      name: 'docs',
      kind: SkillFileNodeKind.Folder,
    };
    const { result } = renderActions([existing]);

    act(() => result.current.fileActions.onCreateFolder?.('docs'));

    expect(result.current.files).toEqual([existing]);
  });

  it.each([
    'files',
    'docs/.dial-folder',
    'v',
    '.dial_folder',
    'docs/.dial_folder',
  ])('rejects the reserved folder path %j', (path) => {
    const { result } = renderActions();

    expect(result.current.fileActions.validateFolderPath?.(path)).toBe(
      'invalid',
    );
  });

  it('accepts an ordinary nested folder path', () => {
    const { result } = renderActions();

    expect(
      result.current.fileActions.validateFolderPath?.('docs/img'),
    ).toBeUndefined();
  });

  it('exposes archive expansion', () => {
    const { result } = renderActions();

    expect(result.current.fileActions.extractArchive).toBeTypeOf('function');
  });

  it('passes the host file-system picker through unchanged', () => {
    const pickFromFileSystem = vi.fn(async () => undefined);
    const { result } = renderActions([], pickFromFileSystem);

    expect(result.current.fileActions.pickFromFileSystem).toBe(
      pickFromFileSystem,
    );
  });

  it('omits the file-system picker when the host supplies none', () => {
    const { result } = renderActions();

    expect(result.current.fileActions.pickFromFileSystem).toBeUndefined();
  });
});
