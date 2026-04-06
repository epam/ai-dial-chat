import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { EnumMapper } from '@/src/utils/app/mappers';
import { isMyBucket, splitEntityId } from '@/src/utils/app/shared-utils';
import { parseEntityApiKey } from '@/src/utils/server/api';

import { Translation } from '@/src/types/translation';

import { ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareSelectors } from '@/src/store/selectors';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

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

  const resourceId = unshareEntity?.id ?? unshareResourceId ?? '';

  const isFolder = useAppSelector(ShareSelectors.selectShareIsFolder);

  const description = useMemo(() => {
    const { bucket } = splitEntityId(resourceId);
    const isAuthor = isMyBucket(bucket);
    const { name } = parseEntityApiKey(resourceId, {
      parseVersion: false,
      parseModel: false,
    });

    return (
      <span>
        {t('Are you sure you want to remove')}{' '}
        <strong>{t(isAuthor ? 'access for all users' : 'your access')}</strong>{' '}
        {t('to {{name}}?', { name: name ?? shareResourceName })}
      </span>
    );
  }, [shareResourceName, t, resourceId]);

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
              resourceIds: [unshareResourceId],
            }),
          );
          dispatch(ShareActions.setUnshareResourceId(undefined));
        }

        if (unshareEntity?.isShared) {
          dispatch(
            ShareActions.revokeAccess({
              ...revokePayload,
              resourceIds: [unshareEntity.id],
            }),
          );
          dispatch(ShareActions.setUnshareEntity(undefined));
        }
      }

      if (unshareEntity?.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceIds: [unshareEntity.id],
            featureType: EnumMapper.getFeatureTypeByApiKey(
              splitEntityId(unshareEntity.id).apiKey,
            ),
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
      heading={t('Confirm unsharing')}
      description={description}
      confirmLabel={t('Unshare')}
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
