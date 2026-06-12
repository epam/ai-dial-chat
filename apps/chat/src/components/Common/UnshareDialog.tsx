import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { dispatchFileManagerUnshareFromEnrichedItems } from '@/src/utils/app/file-manager-unshare-dispatch';
import { isConversationId, isPromptId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { isMyBucket, splitEntityId } from '@/src/utils/app/shared-utils';
import { parseEntityApiKey } from '@/src/utils/server/api';

import { Translation } from '@/src/types/translation';

import { PromptsActions, ShareActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareSelectors } from '@/src/store/selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { withRenderWhen } from './RenderWhen';

function getDialPathDisplayName(path: string) {
  const { name } = parseEntityApiKey(splitEntityId(path).name, {
    parseVersion: true,
    parseModel: isConversationId(path),
  });

  return name ?? path;
}

const view = withRenderWhen((state) => {
  const unshareModel = ShareSelectors.selectUnshareModel(state);
  const unshareResource = ShareSelectors.selectUnshareResourceId(state);
  const fileManagerItems = ShareSelectors.selectUnshareFileManagerItems(state);

  return (
    !!unshareModel ||
    !!unshareResource ||
    !!(fileManagerItems && fileManagerItems.length > 0)
  );
})(() => {
  const { t } = useTranslation(Translation.Common);
  const dispatch = useAppDispatch();

  const unshareEntity = useAppSelector(ShareSelectors.selectUnshareModel);
  const unshareResourceId = useAppSelector(
    ShareSelectors.selectUnshareResourceId,
  );
  const unshareFileManagerItems = useAppSelector(
    ShareSelectors.selectUnshareFileManagerItems,
  );
  const shareResourceName = useAppSelector(
    ShareSelectors.selectShareResourceName,
  );
  const shareFeatureType = useAppSelector(
    ShareSelectors.selectShareFeatureType,
  );
  const isFolder = useAppSelector(ShareSelectors.selectShareIsFolder);

  const isFileManagerUnshare = !!unshareFileManagerItems?.length;

  const fileManagerDescription = useMemo(() => {
    if (!unshareFileManagerItems?.length) {
      return null;
    }

    const discardPaths = unshareFileManagerItems
      .filter((item) => item.sharedWithMe)
      .map((item) => item.path);
    const revokePaths = unshareFileManagerItems
      .filter((item) => item.isShared)
      .map((item) => item.path);

    const joinNames = (paths: string[]) => {
      const labels = paths.map(getDialPathDisplayName);
      const head = labels.slice(0, 5).join(', ');

      return labels.length > 5 ? `${head}…` : head;
    };

    const hasDiscard = discardPaths.length > 0;
    const hasRevoke = revokePaths.length > 0;

    if (!hasDiscard && !hasRevoke) {
      return t(CommonI18nKeys.ConfirmRemoveYourAccess, {
        name: joinNames(unshareFileManagerItems.map((item) => item.path)),
      });
    }

    if (hasDiscard && hasRevoke) {
      return `${t(CommonI18nKeys.ConfirmRemoveYourAccess, {
        name: joinNames(discardPaths),
      })} ${t(CommonI18nKeys.ConfirmRemoveAllUsersAccess, {
        name: joinNames(revokePaths),
      })}`;
    }

    if (hasDiscard) {
      return t(CommonI18nKeys.ConfirmRemoveYourAccess, {
        name: joinNames(discardPaths),
      });
    }

    return t(CommonI18nKeys.ConfirmRemoveAllUsersAccess, {
      name: joinNames(revokePaths),
    });
  }, [t, unshareFileManagerItems]);

  const singleResourceDescription = useMemo(() => {
    if (isFileManagerUnshare) {
      return null;
    }

    const resourceId = unshareEntity?.id ?? unshareResourceId ?? '';
    const { bucket } = splitEntityId(resourceId);
    const isAuthor = isMyBucket(bucket);
    const { name } = parseEntityApiKey(splitEntityId(resourceId).name, {
      parseVersion: true,
      parseModel: isConversationId(resourceId),
    });

    return t(
      isAuthor
        ? CommonI18nKeys.ConfirmRemoveAllUsersAccess
        : CommonI18nKeys.ConfirmRemoveYourAccess,
      {
        name: name ?? shareResourceName,
      },
    );
  }, [
    isFileManagerUnshare,
    shareResourceName,
    t,
    unshareEntity,
    unshareResourceId,
  ]);

  const description =
    isFileManagerUnshare && fileManagerDescription !== null
      ? fileManagerDescription
      : (singleResourceDescription ?? '');

  const handleConfirmUnshare = useCallback(
    (confirmation: boolean) => {
      if (!confirmation) {
        if (unshareEntity) {
          dispatch(ShareActions.setUnshareEntity(undefined));
        } else if (unshareResourceId) {
          dispatch(ShareActions.setUnshareResourceId(undefined));
        } else if (unshareFileManagerItems?.length) {
          dispatch(ShareActions.setUnshareFileManagerItems(undefined));
        }

        return;
      }

      if (unshareFileManagerItems?.length) {
        dispatchFileManagerUnshareFromEnrichedItems(
          dispatch,
          unshareFileManagerItems,
        );
        dispatch(ShareActions.setUnshareFileManagerItems(undefined));

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

        if (isPromptId(unshareEntity.id)) {
          dispatch(PromptsActions.selectPrompt({ promptId: undefined }));
        }
      }
    },
    [
      dispatch,
      isFolder,
      shareFeatureType,
      unshareEntity,
      unshareFileManagerItems,
      unshareResourceId,
    ],
  );

  return (
    <ConfirmDialog
      isOpen
      heading={t(CommonI18nKeys.ConfirmUnsharing)}
      description={description}
      confirmLabel={t(CommonI18nKeys.Unshare)}
      cancelLabel={t(CommonI18nKeys.Cancel)}
      onClose={handleConfirmUnshare}
    />
  );
});

export const UnshareDialog = view;
