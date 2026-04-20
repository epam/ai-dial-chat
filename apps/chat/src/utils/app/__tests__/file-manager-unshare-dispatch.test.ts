import { describe, expect, it, vi } from 'vitest';

import {
  dispatchDiscardSharedWithMeForDialItems,
  dispatchFileManagerUnshareFromEnrichedItems,
  dispatchOpenFileManagerUnshareDialog,
  dispatchRevokeAccessForDialItems,
  enrichUnshareFileManagerItems,
} from '@/src/utils/app/file-manager-unshare-dispatch';

import { ShareActions } from '@/src/store/actions';

import { FeatureType } from '@epam/ai-dial-shared';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';

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

  it('enrichUnshareFileManagerItems maps paths and applies source flags only', () => {
    expect(enrichUnshareFileManagerItems([], 'unshare-files')).toEqual([]);

    expect(
      enrichUnshareFileManagerItems([{ path: 'x' }], 'unshare-files'),
    ).toEqual([
      {
        path: 'x',
        nodeType: undefined,
        sharedWithMe: true,
        isShared: false,
      },
    ]);
    expect(
      enrichUnshareFileManagerItems([{ path: 'y' }], 'remove-access'),
    ).toEqual([
      {
        path: 'y',
        nodeType: undefined,
        sharedWithMe: false,
        isShared: true,
      },
    ]);

    expect(
      enrichUnshareFileManagerItems(
        [{ path: 'files/bucket/f.txt', nodeType: DialFileNodeType.ITEM }],
        'unshare-files',
      ),
    ).toEqual([
      {
        path: 'files/bucket/f.txt',
        nodeType: DialFileNodeType.ITEM,
        sharedWithMe: true,
        isShared: false,
      },
    ]);

    expect(
      enrichUnshareFileManagerItems(
        [{ path: 'files/bucket/sub/', nodeType: DialFileNodeType.FOLDER }],
        'remove-access',
      ),
    ).toEqual([
      {
        path: 'files/bucket/sub/',
        nodeType: DialFileNodeType.FOLDER,
        sharedWithMe: false,
        isShared: true,
      },
    ]);
  });

  it('dispatchOpenFileManagerUnshareDialog no-ops when empty and dispatches setUnshareFileManagerItems (unshare-files vs remove-access)', () => {
    const dispatch = vi.fn();

    dispatchOpenFileManagerUnshareDialog(dispatch, [], 'unshare-files');
    expect(dispatch).not.toHaveBeenCalled();

    dispatchOpenFileManagerUnshareDialog(
      dispatch,
      [{ path: 'only-path' }],
      'unshare-files',
    );
    expect(dispatch).toHaveBeenCalledWith(
      ShareActions.setUnshareFileManagerItems([
        {
          path: 'only-path',
          nodeType: undefined,
          sharedWithMe: true,
          isShared: false,
        },
      ]),
    );

    dispatch.mockClear();
    dispatchOpenFileManagerUnshareDialog(
      dispatch,
      [{ path: 'revoke-path' }],
      'remove-access',
    );
    expect(dispatch).toHaveBeenCalledWith(
      ShareActions.setUnshareFileManagerItems([
        {
          path: 'revoke-path',
          nodeType: undefined,
          sharedWithMe: false,
          isShared: true,
        },
      ]),
    );
  });
});
