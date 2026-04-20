import { ShareActions } from '@/src/store/actions';
import type { UnshareFileManagerItem } from '@/src/store/share/share.types';

import type { AppDispatch } from '@/src/store';
import { FeatureType } from '@epam/ai-dial-shared';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import groupBy from 'lodash-es/groupBy';

export type FileManagerUnshareDialogSource = 'unshare-files' | 'remove-access';

export function enrichUnshareFileManagerItems(
  items: { path: string; nodeType?: string }[],
  source: FileManagerUnshareDialogSource,
): UnshareFileManagerItem[] {
  return items.map((item) => {
    return {
      path: item.path,
      nodeType: item.nodeType,
      sharedWithMe: source === 'unshare-files' ? true : false,
      isShared: source === 'remove-access' ? true : false,
    };
  });
}

export function dispatchOpenFileManagerUnshareDialog(
  dispatch: AppDispatch,

  items: { path: string; nodeType?: string }[],
  source: FileManagerUnshareDialogSource,
) {
  if (!items.length) {
    return;
  }

  dispatch(
    ShareActions.setUnshareFileManagerItems(
      enrichUnshareFileManagerItems(items, source),
    ),
  );
}

export type DialFileUnsharePathItem = {
  path: string;
  nodeType?: string;
};

export function dispatchDiscardSharedWithMeForDialItems(
  dispatch: AppDispatch,
  items: DialFileUnsharePathItem[],
) {
  if (!items.length) {
    return;
  }

  const grouped = groupBy(items, (item) =>
    item.nodeType === DialFileNodeType.FOLDER ? 'folders' : 'files',
  );

  if (grouped.folders?.length) {
    dispatch(
      ShareActions.discardSharedWithMe({
        resourceIds: grouped.folders.map((f) => f.path),
        featureType: FeatureType.File,
        isFolder: true,
      }),
    );
  }

  if (grouped.files?.length) {
    dispatch(
      ShareActions.discardSharedWithMe({
        resourceIds: grouped.files.map((f) => f.path),
        featureType: FeatureType.File,
        isFolder: false,
      }),
    );
  }
}

export function dispatchRevokeAccessForDialItems(
  dispatch: AppDispatch,
  items: DialFileUnsharePathItem[],
) {
  if (!items.length) {
    return;
  }

  const grouped = groupBy(items, (item) =>
    item.nodeType === DialFileNodeType.FOLDER ? 'folders' : 'files',
  );

  if (grouped.folders?.length) {
    dispatch(
      ShareActions.revokeAccess({
        resourceIds: grouped.folders.map(({ path }) => path),
        featureType: FeatureType.File,
        isFolder: true,
      }),
    );
  }

  if (grouped.files?.length) {
    dispatch(
      ShareActions.revokeAccess({
        resourceIds: grouped.files.map(({ path }) => path),
        featureType: FeatureType.File,
        isFolder: false,
      }),
    );
  }
}

export function dispatchFileManagerUnshareFromEnrichedItems(
  dispatch: AppDispatch,
  items: UnshareFileManagerItem[],
) {
  const discardItems = items
    .filter((item) => item.sharedWithMe)
    .map(({ path, nodeType }) => ({ path, nodeType }));
  const revokeItems = items
    .filter((item) => item.isShared)
    .map(({ path, nodeType }) => ({ path, nodeType }));

  dispatchDiscardSharedWithMeForDialItems(dispatch, discardItems);
  dispatchRevokeAccessForDialItems(dispatch, revokeItems);
}
