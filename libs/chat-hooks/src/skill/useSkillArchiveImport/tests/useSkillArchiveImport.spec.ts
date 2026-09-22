import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  classifySkillArchiveImportError,
  SkillArchiveImportErrorKind,
  SkillArchiveImportStatus,
  SkillArchiveSelectionRejectionReason,
  useSkillArchiveImport,
  type UseSkillArchiveImportOptions,
} from '../useSkillArchiveImport';

interface Result {
  name: string;
}

const buildOptions = (
  overrides: Partial<UseSkillArchiveImportOptions<Result>> = {},
): UseSkillArchiveImportOptions<Result> => ({
  importArchive: vi.fn().mockResolvedValue({ name: 'docs-helper' }),
  onImported: vi.fn(),
  onError: vi.fn(),
  ...overrides,
});

describe('useSkillArchiveImport', () => {
  it('starts idle with the dialog closed and no rejection/error', () => {
    const { result } = renderHook(() => useSkillArchiveImport(buildOptions()));

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.status).toBe(SkillArchiveImportStatus.Idle);
    expect(result.current.selectionRejectionReason).toBeUndefined();
    expect(result.current.errorKind).toBeUndefined();
  });

  it('opens the dialog without submitting anything', () => {
    const options = buildOptions();
    const { result } = renderHook(() => useSkillArchiveImport(options));

    act(() => {
      result.current.openDialog();
    });

    expect(result.current.isDialogOpen).toBe(true);
    expect(options.importArchive).not.toHaveBeenCalled();
  });

  it('closes the dialog and clears a rejection reason', () => {
    const { result } = renderHook(() => useSkillArchiveImport(buildOptions()));

    act(() => {
      result.current.openDialog();
    });
    act(() => {
      result.current.handleFilesRejected();
    });
    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.isDialogOpen).toBe(false);
    expect(result.current.selectionRejectionReason).toBeUndefined();
  });

  it('submits a ZIP file once, closes the dialog, and reaches success', async () => {
    const options = buildOptions();
    const { result } = renderHook(() => useSkillArchiveImport(options));
    const file = new File(['zip bytes'], 'skill.zip');

    act(() => {
      result.current.openDialog();
    });

    await act(async () => {
      result.current.handleFilesSelected([file]);
      await Promise.resolve();
    });

    expect(options.importArchive).toHaveBeenCalledOnce();
    expect(options.importArchive).toHaveBeenCalledWith(file);
    expect(result.current.isDialogOpen).toBe(false);
    expect(options.onImported).toHaveBeenCalledOnce();
    expect(options.onImported).toHaveBeenCalledWith({
      name: 'docs-helper',
    });
    expect(result.current.status).toBe(SkillArchiveImportStatus.Success);
  });

  it('submits a file named exactly SKILL.md', async () => {
    const options = buildOptions();
    const { result } = renderHook(() => useSkillArchiveImport(options));
    const file = new File(['---\nname: docs-helper\n---\n'], 'SKILL.md');

    await act(async () => {
      result.current.handleFilesSelected([file]);
      await Promise.resolve();
    });

    expect(options.importArchive).toHaveBeenCalledOnce();
    expect(options.importArchive).toHaveBeenCalledWith(file);
    expect(result.current.status).toBe(SkillArchiveImportStatus.Success);
  });

  it('rejects a wrong-case Markdown filename locally, keeping the dialog open', () => {
    const options = buildOptions();
    const { result } = renderHook(() => useSkillArchiveImport(options));

    act(() => {
      result.current.openDialog();
    });
    act(() => {
      result.current.handleFilesSelected([new File(['content'], 'skill.md')]);
    });

    expect(options.importArchive).not.toHaveBeenCalled();
    expect(result.current.isDialogOpen).toBe(true);
    expect(result.current.status).toBe(SkillArchiveImportStatus.Error);
    expect(result.current.selectionRejectionReason).toBe(
      SkillArchiveSelectionRejectionReason.UnsupportedFilename,
    );
  });

  it('reports a drop the drop zone excluded by extension', () => {
    const { result } = renderHook(() => useSkillArchiveImport(buildOptions()));

    act(() => {
      result.current.handleFilesRejected();
    });

    expect(result.current.selectionRejectionReason).toBe(
      SkillArchiveSelectionRejectionReason.UnsupportedFilename,
    );
    expect(result.current.status).toBe(SkillArchiveImportStatus.Error);
  });

  it('does nothing when selection is empty', () => {
    const options = buildOptions();
    const { result } = renderHook(() => useSkillArchiveImport(options));

    act(() => {
      result.current.handleFilesSelected([]);
    });

    expect(options.importArchive).not.toHaveBeenCalled();
    expect(result.current.status).toBe(SkillArchiveImportStatus.Idle);
  });

  it('does not start a second request while one is pending, then accepts a retry of the same file after it settles', async () => {
    let resolveImport: (value: Result) => void = () => undefined;
    const options = buildOptions({
      importArchive: vi.fn().mockImplementation(
        () =>
          new Promise<Result>((resolve) => {
            resolveImport = resolve;
          }),
      ),
    });
    const { result } = renderHook(() => useSkillArchiveImport(options));
    const file = new File(['zip bytes'], 'skill.zip');

    act(() => {
      result.current.handleFilesSelected([file]);
    });

    act(() => {
      result.current.openDialog();
    });
    expect(result.current.isDialogOpen).toBe(false);

    act(() => {
      result.current.handleFilesSelected([file]);
    });
    expect(options.importArchive).toHaveBeenCalledOnce();

    await act(async () => {
      resolveImport({ name: 'docs-helper' });
      await Promise.resolve();
    });
    expect(result.current.status).toBe(SkillArchiveImportStatus.Success);

    await act(async () => {
      result.current.handleFilesSelected([file]);
      await Promise.resolve();
    });

    expect(options.importArchive).toHaveBeenCalledTimes(2);
  });

  it('classifies a mapped failure and invokes onError once without calling onImported', async () => {
    const error = { response: new Response(null, { status: 409 }) };
    const options = buildOptions({
      importArchive: vi.fn().mockRejectedValue(error),
    });
    const { result } = renderHook(() => useSkillArchiveImport(options));

    await act(async () => {
      result.current.handleFilesSelected([
        new File(['zip bytes'], 'skill.zip'),
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe(SkillArchiveImportStatus.Error);
    expect(result.current.errorKind).toBe(
      SkillArchiveImportErrorKind.Collision,
    );
    expect(options.onError).toHaveBeenCalledOnce();
    expect(options.onError).toHaveBeenCalledWith(
      error,
      SkillArchiveImportErrorKind.Collision,
    );
    expect(options.onImported).not.toHaveBeenCalled();
  });

  it('classifies an unmapped/network failure as generic', async () => {
    const error = new Error('network down');
    const options = buildOptions({
      importArchive: vi.fn().mockRejectedValue(error),
    });
    const { result } = renderHook(() => useSkillArchiveImport(options));

    await act(async () => {
      result.current.handleFilesSelected([
        new File(['zip bytes'], 'skill.zip'),
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.errorKind).toBe(SkillArchiveImportErrorKind.Generic);
    expect(options.onError).toHaveBeenCalledOnce();
    expect(options.onError).toHaveBeenCalledWith(
      error,
      SkillArchiveImportErrorKind.Generic,
    );
  });

  it('reports a generic failure through onError, without resubmitting, when the awaited host refresh rejects', async () => {
    const refreshError = new Error('refresh failed');
    const options = buildOptions({
      onImported: vi.fn().mockRejectedValue(refreshError),
    });
    const { result } = renderHook(() => useSkillArchiveImport(options));

    await act(async () => {
      result.current.handleFilesSelected([
        new File(['zip bytes'], 'skill.zip'),
      ]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(options.importArchive).toHaveBeenCalledOnce();
    expect(options.onImported).toHaveBeenCalledOnce();
    expect(result.current.status).toBe(SkillArchiveImportStatus.Error);
    expect(options.onError).toHaveBeenCalledOnce();
    expect(options.onError).toHaveBeenCalledWith(
      refreshError,
      SkillArchiveImportErrorKind.Generic,
    );
  });

  it('performs no state update or host completion notification when the import settles after unmount', async () => {
    let resolveImport: (value: Result) => void = () => undefined;
    const options = buildOptions({
      importArchive: vi.fn().mockImplementation(
        () =>
          new Promise<Result>((resolve) => {
            resolveImport = resolve;
          }),
      ),
    });
    const { result, unmount } = renderHook(() =>
      useSkillArchiveImport(options),
    );

    act(() => {
      result.current.handleFilesSelected([
        new File(['zip bytes'], 'skill.zip'),
      ]);
    });

    unmount();

    await act(async () => {
      resolveImport({ name: 'docs-helper' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(options.onImported).not.toHaveBeenCalled();
    expect(options.onError).not.toHaveBeenCalled();
  });

  it('clears a stale rejection reason when the dialog is reopened', () => {
    const { result } = renderHook(() => useSkillArchiveImport(buildOptions()));

    act(() => {
      result.current.handleFilesRejected();
    });
    act(() => {
      result.current.openDialog();
    });

    expect(result.current.selectionRejectionReason).toBeUndefined();
  });
});

describe('classifySkillArchiveImportError', () => {
  it.each([
    [400, SkillArchiveImportErrorKind.Validation],
    [413, SkillArchiveImportErrorKind.Validation],
    [422, SkillArchiveImportErrorKind.Validation],
    [409, SkillArchiveImportErrorKind.Collision],
    [429, SkillArchiveImportErrorKind.RateLimited],
    [502, SkillArchiveImportErrorKind.ServiceUnavailable],
    [503, SkillArchiveImportErrorKind.ServiceUnavailable],
    [401, SkillArchiveImportErrorKind.Generic],
    [undefined, SkillArchiveImportErrorKind.Generic],
  ])('maps status %s to %s', (status, expected) => {
    expect(classifySkillArchiveImportError(status)).toBe(expected);
  });
});
