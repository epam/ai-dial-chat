import { describe, expect, it } from 'vitest';

import { Subject, lastValueFrom, of, toArray } from 'rxjs';

import { StateObservable } from 'redux-observable';

import { FilesEpics } from '../files.epics';
import { FilesActions } from '../files.reducers';

const runEpic = (action: ReturnType<typeof FilesActions.getFoldersList>) => {
  const state$ = new StateObservable(new Subject(), {} as never);

  return lastValueFrom(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FilesEpics(of(action) as any, state$ as any, {} as any).pipe(toArray()),
  );
};

describe('files.epics getFoldersList', () => {
  it('lists only the folders of every path by default', async () => {
    const emitted = await runEpic(
      FilesActions.getFoldersList({ paths: ['files/bucket/a', undefined] }),
    );

    expect(emitted).toEqual([
      FilesActions.getFolders({ id: 'files/bucket/a' }),
      FilesActions.getFolders({ id: undefined }),
    ]);
  });

  it('lists the files of every path as well when asked to', async () => {
    const emitted = await runEpic(
      FilesActions.getFoldersList({
        paths: ['files/bucket/renamed', 'files/bucket/renamed/child'],
        withFiles: true,
      }),
    );

    // Folders alone would mark each path loaded and leave the branch empty.
    expect(emitted).toEqual([
      FilesActions.getFolders({ id: 'files/bucket/renamed' }),
      FilesActions.getFiles({ id: 'files/bucket/renamed' }),
      FilesActions.getFolders({ id: 'files/bucket/renamed/child' }),
      FilesActions.getFiles({ id: 'files/bucket/renamed/child' }),
    ]);
  });

  it('falls back to the root listing when no paths are given', async () => {
    expect(await runEpic(FilesActions.getFoldersList({}))).toEqual([
      FilesActions.getFolders({}),
    ]);

    expect(
      await runEpic(FilesActions.getFoldersList({ withFiles: true })),
    ).toEqual([FilesActions.getFolders({}), FilesActions.getFiles({})]);
  });
});
