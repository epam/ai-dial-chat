import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSkillFileSystemPicker } from '../useSkillFileSystemPicker';

const file = (name: string, nodeType = DialFileNodeType.ITEM): DialFile => ({
  folderId: '',
  id: name,
  name,
  path: name,
  nodeType,
});
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe('skill file selection lifetime', () => {
  it('filters folders and preserves selection order despite completion order', async () => {
    const first = deferred<string>();
    const load = vi.fn((entry: DialFile) =>
      entry.name === 'a' ? first.promise : Promise.resolve('b'),
    );
    const { result } = renderHook(() =>
      useSkillFileSystemPicker({ materializeFile: load, onError: vi.fn() }),
    );
    let picked!: Promise<string[] | undefined>;
    act(() => {
      picked = result.current.pickFromFileSystem();
    });
    expect(result.current.isOpen).toBe(true);
    act(() =>
      result.current.handleAttach({
        files: [file('a'), file('folder', DialFileNodeType.FOLDER), file('b')],
        folderPaths: [],
      }),
    );
    expect(result.current.isOpen).toBe(false);
    first.resolve('a');
    expect(await picked).toEqual(['a', 'b']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it.each(
    ['close', 'unmount', 'replace'].flatMap((mode) =>
      ['success', 'failure'].map((outcome) => ({ mode, outcome })),
    ),
  )(
    'cancels pending downloads on $mode and ignores late $outcome',
    async ({ mode, outcome }) => {
      const old = deferred<string>();
      let signal!: AbortSignal;
      const onError = vi.fn();
      const load = vi.fn((_file: DialFile, abort: AbortSignal) => {
        signal = abort;
        return old.promise;
      });
      const { result, unmount } = renderHook(() =>
        useSkillFileSystemPicker({ materializeFile: load, onError }),
      );
      let picked!: Promise<string[] | undefined>;
      act(() => {
        picked = result.current.pickFromFileSystem();
      });
      act(() =>
        result.current.handleAttach({ files: [file('a')], folderPaths: [] }),
      );
      let next: Promise<string[] | undefined> | undefined;
      if (mode === 'unmount') unmount();
      else
        act(() => {
          if (mode === 'replace') next = result.current.pickFromFileSystem();
          else result.current.handleClose();
        });
      expect(await picked).toBeUndefined();
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (outcome === 'success') old.resolve('obsolete');
        else old.reject(new Error('obsolete'));
      });
      expect(onError).not.toHaveBeenCalled();
      if (next) {
        expect(result.current.isOpen).toBe(true);
        act(() => result.current.handleAttach({ files: [], folderPaths: [] }));
        expect(await next).toEqual([]);
      }
    },
  );

  it('settles and reports an active download failure', async () => {
    const error = new Error('download');
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useSkillFileSystemPicker({
        materializeFile: vi.fn().mockRejectedValue(error),
        onError,
      }),
    );
    let picked!: Promise<unknown[] | undefined>;
    act(() => {
      picked = result.current.pickFromFileSystem();
    });
    act(() =>
      result.current.handleAttach({ files: [file('a')], folderPaths: [] }),
    );
    expect(await picked).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(error);
  });
});
