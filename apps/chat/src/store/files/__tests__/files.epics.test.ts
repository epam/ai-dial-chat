import { describe, expect, it } from 'vitest';

import { Subject, lastValueFrom, of, toArray } from 'rxjs';

import { StateObservable } from 'redux-observable';

import { ReplaceOptions } from '@/src/types/common';

import { FilesEpics } from '../files.epics';
import { FilesActions, filesSlice } from '../files.reducers';
import { UploadReplaceDialogState } from '../files.types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runEpic = (action: any, filesState = filesSlice.getInitialState()) => {
  const state$ = new StateObservable(new Subject(), {
    files: filesState,
  } as never);

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

describe('files.epics continueUploadReplaceDialog', () => {
  const folderId = 'files/test-bucket/uploads';
  const fileId = `${folderId}/sun.jpg`;

  const openDialog = (selectFileIds: boolean) => {
    const dialog: UploadReplaceDialogState = {
      isOpen: false,
      duplicatedFiles: [],
      nonDuplicatedFiles: [
        {
          id: fileId,
          name: 'sun.jpg',
          fileContent: new File(['content'], 'sun.jpg', { type: 'image/jpeg' }),
        },
      ],
      folderId,
      folderPath: 'uploads',
      bucket: 'test-bucket',
      showSuccessMessage: true,
      selectFileIds,
      mappedActions: { [fileId]: ReplaceOptions.Postfix },
    };

    return { ...filesSlice.getInitialState(), uploadReplaceDialog: dialog };
  };

  const run = (selectFileIds: boolean) =>
    runEpic(
      FilesActions.continueUploadReplaceDialog({
        mappedActions: { [fileId]: ReplaceOptions.Postfix },
      }),
      openDialog(selectFileIds),
    );

  it('selects the resolved files for an uploader that selects into the store', async () => {
    const types = (await run(true)).map(({ type }) => type);

    expect(types).toContain(FilesActions.selectFiles.type);
    // Broadcasting the ids as well attached a file uploaded from the chat
    // input to any message open in edit mode. Issue #7876
    expect(types).not.toContain(FilesActions.setResolvedUploadIds.type);
  });

  it('publishes the resolved ids for an uploader that opted out of selecting', async () => {
    const emitted = await run(false);
    const types = emitted.map(({ type }) => type);

    expect(types).toContain(FilesActions.setResolvedUploadIds.type);
    expect(types).not.toContain(FilesActions.selectFiles.type);
    expect(
      emitted.find(
        ({ type }) => type === FilesActions.setResolvedUploadIds.type,
      ),
    ).toEqual(FilesActions.setResolvedUploadIds({ ids: [fileId] }));
  });
});
