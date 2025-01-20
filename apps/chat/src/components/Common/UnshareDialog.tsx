import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { FeatureType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { useAppDispatch } from '@/src/store/hooks';
import { ShareActions } from '@/src/store/share/share.reducers';

import { ConfirmDialog } from './ConfirmDialog';

interface UnshareDialogProps {
  entity: DialAIEntityModel;
  setOpened: (state: boolean) => void;
}

const UnshareDialog = ({ entity, setOpened }: UnshareDialogProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const handleConfirmUnshare = useCallback(
    (confirmation: boolean) => {
      if (!confirmation) {
        setOpened(false);
        return;
      }

      if (entity.isShared) {
        dispatch(
          ShareActions.revokeAccess({
            resourceId: entity.id,
            featureType: FeatureType.Application,
          }),
        );
      }

      if (entity.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: [entity.id],
            featureType: FeatureType.Application,
          }),
        );
      }

      setOpened(false);
    },
    [dispatch, entity.id, entity.isShared, entity.sharedWithMe, setOpened],
  );

  return (
    <ConfirmDialog
      isOpen
      heading={t('Confirm unsharing')}
      description={
        t(`Are you sure you want to remove your access to ${entity.name}?`) ||
        ''
      }
      confirmLabel={t('Unshare')}
      cancelLabel={t('Cancel')}
      onClose={handleConfirmUnshare}
    />
  );
};

export default UnshareDialog;
