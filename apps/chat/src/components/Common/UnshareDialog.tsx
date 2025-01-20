import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { ShareActions, ShareSelectors } from '@/src/store/share/share.reducers';

import { ConfirmDialog } from './ConfirmDialog';

export const UnshareDialog = () => {
  const isUnshareModal = useAppSelector(ShareSelectors.selectUnshareModal);
  if (isUnshareModal === ModalState.OPENED) {
    return <UnshareDialogView />;
  }
};

const UnshareDialogView = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const shareResourceId = useAppSelector(ShareSelectors.selectShareResourceId);

  const entity = useAppSelector((state) =>
    ModelsSelectors.selectModelById(state, shareResourceId),
  );

  const description = t(
    `Are you sure you want to remove ${entity?.isShared ? 'access for all users' : 'your access'} to ${entity?.name}?`,
  );

  const handleConfirmUnshare = useCallback(
    (confirmation: boolean) => {
      if (!confirmation) {
        dispatch(
          ShareActions.setUnshareModalState({ modalState: ModalState.CLOSED }),
        );
        return;
      }

      if (entity?.isShared) {
        dispatch(
          ShareActions.revokeAccess({
            resourceId: entity.id,
            featureType: FeatureType.Application,
          }),
        );
      }

      if (entity?.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: [entity.id],
            featureType: FeatureType.Application,
          }),
        );
      }

      dispatch(
        ShareActions.setUnshareModalState({ modalState: ModalState.CLOSED }),
      );
    },
    [dispatch, entity?.id, entity?.isShared, entity?.sharedWithMe],
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
