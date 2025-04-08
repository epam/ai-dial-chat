import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions, ShareSelectors } from '@/src/store/share/share.reducers';

import { ConfirmDialog } from './ConfirmDialog';
import { withRenderWhen } from './RenderWhen';

function UnshareDialogView() {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const unshareEntity = useAppSelector(ShareSelectors.selectUnshareModel);
  const unshareResourceId = useAppSelector(
    ShareSelectors.selectUnshareResourceId,
  );
  const shareResourceName = useAppSelector(
    ShareSelectors.selectShareResourceName,
  );

  const shareFeatureType = useAppSelector(
    ShareSelectors.selectShareFeatureType,
  );

  const isFolder = useAppSelector(ShareSelectors.selectShareIsFolder);

  const description = isFolder
    ? t(
        `Are you sure you want to remove access for all users to ${shareResourceName}?`,
      )
    : t(
        `Are you sure you want to remove ${
          unshareEntity?.isShared ? 'access for all users' : 'your access'
        } to ${unshareEntity ? unshareEntity?.name : shareResourceName}?`,
      );

  const handleConfirmUnshare = useCallback(
    (confirmation: boolean) => {
      if (!confirmation) {
        dispatch(
          unshareEntity
            ? ShareActions.setUnshareEntity(undefined)
            : ShareActions.setUnshareResourceId(undefined),
        );
        return;
      }

      if (shareFeatureType) {
        const revokePayload = {
          featureType: shareFeatureType,
          isFolder,
        };

        if (unshareResourceId) {
          dispatch(
            ShareActions.revokeAccess({
              ...revokePayload,
              resourceId: unshareResourceId,
            }),
          );
          dispatch(ShareActions.setUnshareResourceId(undefined));
        }

        if (unshareEntity?.isShared) {
          dispatch(
            ShareActions.revokeAccess({
              ...revokePayload,
              resourceId: unshareEntity.id,
            }),
          );
          dispatch(ShareActions.setUnshareEntity(undefined));
        }
      }

      if (unshareEntity?.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: [unshareEntity.id],
            featureType: FeatureType.Application,
          }),
        );
        dispatch(ShareActions.setUnshareEntity(undefined));
      }
    },
    [dispatch, shareFeatureType, isFolder, unshareEntity, unshareResourceId],
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
  const unshareResource = ShareSelectors.selectUnshareResourceId(state);

  return !!unshareModel || !!unshareResource;
})(UnshareDialogView);
