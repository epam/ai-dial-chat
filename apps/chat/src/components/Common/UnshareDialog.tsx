import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions, ShareSelectors } from '@/src/store/share/share.reducers';

import { ConfirmDialog } from './ConfirmDialog';
import { withRenderWhen } from './RenderWhen';

function UnshareDialogView() {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const unshareEntity = useAppSelector(ShareSelectors.selectUnshareModel);
  const unshareFolderId = useAppSelector(ShareSelectors.selectUnshareFolderId);

  const shareFeatureType = useAppSelector(
    ShareSelectors.selectShareFeatureType,
  );

  const isFolder = useAppSelector(ShareSelectors.selectShareIsFolder);

  const description = isFolder
    ? t('Are you sure you want to remove access for all users to this folder?')
    : t(
        `Are you sure you want to remove ${
          unshareEntity?.isShared ? 'access for all users' : 'your access'
        } to ${unshareEntity?.name}?`,
      );

  const handleConfirmUnshare = useCallback(
    (confirmation: boolean) => {
      if (!confirmation) {
        dispatch(
          isFolder
            ? ShareActions.setUnshareFolderId(undefined)
            : ShareActions.setUnshareEntity(undefined),
        );
        return;
      }
      if (shareFeatureType) {
        if (isFolder) {
          unshareFolderId &&
            dispatch(
              ShareActions.revokeAccess({
                resourceId: unshareFolderId,
                isFolder: true,
                featureType: shareFeatureType,
              }),
            );
          dispatch(ShareActions.setUnshareFolderId(undefined));
        } else {
          if (unshareEntity?.isShared) {
            dispatch(
              ShareActions.revokeAccess({
                resourceId: unshareEntity.id,
                featureType: shareFeatureType,
              }),
            );
          }

          if (unshareEntity?.sharedWithMe) {
            dispatch(
              ShareActions.discardSharedWithMe({
                resourceIds: [unshareEntity.id],
                featureType: shareFeatureType,
              }),
            );
          }

          dispatch(ShareActions.setUnshareEntity(undefined));
        }
      }
    },
    [dispatch, shareFeatureType, isFolder, unshareEntity, unshareFolderId],
  );

  return (
    <ConfirmDialog
      isOpen
      heading={t('Confirm removing access')}
      description={description}
      confirmLabel={t('Confirm')}
      cancelLabel={t('Cancel')}
      onClose={handleConfirmUnshare}
    />
  );
}

export const UnshareDialog = withRenderWhen((state) => {
  const unshareModel = ShareSelectors.selectUnshareModel(state);
  const unshareFolder = ShareSelectors.selectUnshareFolderId(state);

  return !!unshareModel || !!unshareFolder;
})(UnshareDialogView);
