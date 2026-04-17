import { describe, expect, it, vi } from 'vitest';

import {
  dispatchDiscardSharedWithMeForDialItems,
  dispatchFileManagerUnshareFromEnrichedItems,
  dispatchOpenFileManagerUnshareDialog,
  dispatchRevokeAccessForDialItems,
  enrichUnshareFileManagerItems,
} from '@/src/utils/app/file-manager-unshare-dispatch';

import type { DialFile, FileFolderInterface } from '@/src/types/files';
import type { RootState } from '@/src/types/store';

import { ShareActions } from '@/src/store/actions';
import { filesSlice } from '@/src/store/files/files.reducers';

import { FeatureType } from '@epam/ai-dial-shared';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';

function rootStateWithEntities(
  files: DialFile[],
  folders: FileFolderInterface[],
): RootState {
  return {
    files: {
      ...filesSlice.getInitialState(),
      files,
      folders,
    },
  } as unknown as RootState;
}

describe('file-manager-unshare-dispatch', () => {
  it('dispatchDiscardSharedWithMeForDialItems and dispatchRevokeAccessForDialItems no-op when empty and group folders vs files', () => {
    const dispatch = vi.fn();

    dispatchDiscardSharedWithMeForDialItems(dispatch, []);
    dispatchRevokeAccessForDialItems(dispatch, []);
    expect(dispatch).not.toHaveBeenCalled();

    const items = [
      { path: 'folder-a/', nodeType: DialFileNodeType.FOLDER },
      { path: 'files/bucket/file.txt', nodeType: DialFileNodeType.ITEM },
    ];

    dispatchDiscardSharedWithMeForDialItems(dispatch, items);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toEqual(
      ShareActions.discardSharedWithMe({
        resourceIds: ['folder-a/'],
        featureType: FeatureType.File,
        isFolder: true,
      }),
    );
    expect(dispatch.mock.calls[1][0]).toEqual(
      ShareActions.discardSharedWithMe({
        resourceIds: ['files/bucket/file.txt'],
        featureType: FeatureType.File,
        isFolder: false,
      }),
    );

    dispatch.mockClear();
    dispatchRevokeAccessForDialItems(dispatch, items);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toEqual(
      ShareActions.revokeAccess({
        resourceIds: ['folder-a/'],
        featureType: FeatureType.File,
        isFolder: true,
      }),
    );
    expect(dispatch.mock.calls[1][0]).toEqual(
      ShareActions.revokeAccess({
        resourceIds: ['files/bucket/file.txt'],
        featureType: FeatureType.File,
        isFolder: false,
      }),
    );
  });

  it('dispatchFileManagerUnshareFromEnrichedItems sends discard for sharedWithMe and revoke for isShared', () => {
    const dispatch = vi.fn();

    dispatchFileManagerUnshareFromEnrichedItems(dispatch, [
      {
        path: 'files/bucket/a.txt',
        nodeType: DialFileNodeType.ITEM,
        sharedWithMe: true,
        isShared: false,
      },
      {
        path: 'files/bucket/b.txt',
        nodeType: DialFileNodeType.ITEM,
        sharedWithMe: false,
        isShared: true,
      },
    ]);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0][0]).toEqual(
      ShareActions.discardSharedWithMe({
        resourceIds: ['files/bucket/a.txt'],
        featureType: FeatureType.File,
        isFolder: false,
      }),
    );
    expect(dispatch.mock.calls[1][0]).toEqual(
      ShareActions.revokeAccess({
        resourceIds: ['files/bucket/b.txt'],
        featureType: FeatureType.File,
        isFolder: false,
      }),
    );
  });

  it('enrichUnshareFileManagerItems applies source defaults and store entity flags', () => {
    const empty = rootStateWithEntities([], []);

    expect(
      enrichUnshareFileManagerItems(empty, [{ path: 'x' }], 'unshare-files'),
    ).toEqual([{ path: 'x', sharedWithMe: true, isShared: false }]);
    expect(
      enrichUnshareFileManagerItems(empty, [{ path: 'y' }], 'remove-access'),
    ).toEqual([{ path: 'y', sharedWithMe: false, isShared: true }]);

    const file = {
      id: 'files/bucket/f.txt',
      name: 'f.txt',
      folderId: 'files/bucket',
      sharedWithMe: true,
      isShared: true,
    } as DialFile;
    const folder = {
      id: 'files/bucket/sub/',
      name: 'sub',
      folderId: 'files/bucket',
      sharedWithMe: false,
      isShared: false,
    } as FileFolderInterface;

    const state = rootStateWithEntities([file], [folder]);

    expect(
      enrichUnshareFileManagerItems(
        state,
        [{ path: file.id, nodeType: DialFileNodeType.ITEM }],
        'unshare-files',
      ),
    ).toEqual([
      {
        path: file.id,
        nodeType: DialFileNodeType.ITEM,
        sharedWithMe: true,
        isShared: true,
      },
    ]);

    expect(
      enrichUnshareFileManagerItems(
        state,
        [{ path: folder.id, nodeType: DialFileNodeType.FOLDER }],
        'remove-access',
      ),
    ).toEqual([
      {
        path: folder.id,
        nodeType: DialFileNodeType.FOLDER,
        sharedWithMe: false,
        isShared: false,
      },
    ]);
  });

  it('dispatchOpenFileManagerUnshareDialog no-ops when empty and dispatches setUnshareFileManagerItems (unshare-files vs remove-access)', () => {
    const dispatch = vi.fn();
    const getState = () => rootStateWithEntities([], []);

    dispatchOpenFileManagerUnshareDialog(
      dispatch,
      getState,
      [],
      'unshare-files',
    );
    expect(dispatch).not.toHaveBeenCalled();

    dispatchOpenFileManagerUnshareDialog(
      dispatch,
      getState,
      [{ path: 'only-path' }],
      'unshare-files',
    );
    expect(dispatch).toHaveBeenCalledWith(
      ShareActions.setUnshareFileManagerItems([
        { path: 'only-path', sharedWithMe: true, isShared: false },
      ]),
    );

    dispatch.mockClear();
    dispatchOpenFileManagerUnshareDialog(
      dispatch,
      getState,
      [{ path: 'revoke-path' }],
      'remove-access',
    );
    expect(dispatch).toHaveBeenCalledWith(
      ShareActions.setUnshareFileManagerItems([
        { path: 'revoke-path', sharedWithMe: false, isShared: true },
      ]),
    );
  });
});
