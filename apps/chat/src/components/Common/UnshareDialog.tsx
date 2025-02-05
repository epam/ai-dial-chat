import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions, ShareSelectors } from '@/src/store/share/share.reducers';

import { ConfirmDialog } from './ConfirmDialog';

export const UnshareDialog = () => {
  const unshareEntity = useAppSelector(ShareSelectors.selectUnshareModel);

  if (unshareEntity !== undefined) {
    return <UnshareDialogView />;
  }
};

const UnshareDialogView = () => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();
  const unshareEntity = useAppSelector(ShareSelectors.selectUnshareModel);

  const description = t(
    `Are you sure you want to remove ${unshareEntity?.isShared ? 'access for all users' : 'your access'} to ${unshareEntity?.name}?`,
  );

  const handleConfirmUnshare = useCallback(
    (confirmation: boolean) => {
      if (!confirmation) {
        dispatch(ShareActions.setUnshareEntity(undefined));
        return;
      }

      if (unshareEntity?.isShared) {
        dispatch(
          ShareActions.revokeAccess({
            resourceId: unshareEntity.id,
            featureType: FeatureType.Application,
          }),
        );
      }

      if (unshareEntity?.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: [unshareEntity.id],
            featureType: FeatureType.Application,
          }),
        );
      }

      dispatch(ShareActions.setUnshareEntity(undefined));
    },
    [
      dispatch,
      unshareEntity?.id,
      unshareEntity?.isShared,
      unshareEntity?.sharedWithMe,
    ],
  );

  return (
    <ConfirmDialog
      isOpen
      heading={t('Confirm unsharing')}
      description={description}
      confirmLabel={t('Unshare')}
      cancelLabel={t('Cancel')}
      onClose={handleConfirmUnshare}
    />
  );
};
