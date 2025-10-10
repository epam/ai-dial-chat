import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  isConversationInfoEntity,
  isLoadedConversationEntity,
} from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import {
  getIdWithoutRootPathSegments,
  isConversationId,
  replaceIdWithBucket,
  transformIdToRootEntityId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import {
  createFoldersFilesTargetUrl,
  isEntityIdPublic,
} from '@/src/utils/app/publications';
import { NotReplayFilter } from '@/src/utils/app/search';
import { constructPath, splitEntityId } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { BackendResourceType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import { PublicationStatus } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PublicationActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PromptsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { Modal } from '@/src/components/Common/Modal';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { PublicationHandler } from './PublicationHandler/PublicationHandler';

import {
  Conversation,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';
import compact from 'lodash-es/compact';
import escapeRegExp from 'lodash-es/escapeRegExp';
import flatMapDeep from 'lodash-es/flatMapDeep';

interface PublishDialogContainerProps {
  entity: ShareEntity & { iconUrl?: string };
  action: PublishActions;
  resourceType: BackendResourceType;
  publishCredentials: boolean;
  isFolder: boolean;
  filteredConversationFiles: DialFile[];
}

const transformFoldersFilesIds = (
  conversations: Conversation[],
  entity: ShareEntity,
) => {
  const folderOldPathPartsRegExp = new RegExp(
    escapeRegExp(getIdWithoutRootPathSegments(entity.folderId)),
  );

  return conversations.flatMap((c) => {
    const urls = compact(
      flatMapDeep(c.playback?.messagesStack || c.messages, (m) =>
        m.custom_content?.attachments?.map((a) => a.url),
      ),
    );

    return urls.map((oldUrl) => {
      const decodedOldUrl = ApiUtils.decodeApiUrl(oldUrl);

      return {
        oldUrl: decodedOldUrl,
        newUrl: createFoldersFilesTargetUrl(
          constructPath(
            getFolderIdFromEntityId(c.id),
            ...decodedOldUrl.split('/').slice(-1),
          ).replace(folderOldPathPartsRegExp, ''),
        ),
      };
    });
  });
};

const PublishDialogContainer = ({
  entity,
  action,
  resourceType,
  publishCredentials,
  isFolder,
  filteredConversationFiles,
}: PublishDialogContainerProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const memoizedEntityArray = useMemo(() => [entity], [entity]);

  const areConversationsWithContentUploading = useAppSelector(
    ConversationsSelectors.selectAreConversationsWithContentUploading,
  );
  const entities = useAppSelector((state) => {
    if (!isFolder) return memoizedEntityArray;

    const selector =
      resourceType === BackendResourceType.CONVERSATION
        ? ConversationsSelectors.selectConversationsByFolderId
        : PromptsSelectors.selectPromptsByFolderId;

    return selector(state, entity.id);
  });

  const filteredEntities = useMemo(() => {
    if (!isFolder || action === PublishActions.DELETE) return entities;

    return entities.filter(
      (entity) =>
        !isConversationInfoEntity(entity) ||
        (!entity.isReplay &&
          isLoadedConversationEntity(entity) &&
          (entity.messages.length || entity.playback?.messagesStack.length)),
    );
  }, [action, entities, isFolder]);

  useEffect(() => {
    if (
      !areConversationsWithContentUploading &&
      !filteredEntities.length &&
      action !== PublishActions.DELETE
    ) {
      dispatch(
        UIActions.showErrorToast(t('There are no valid items to publish')),
      );
      dispatch(PublicationActions.setPublishModel());
    }
  }, [
    action,
    areConversationsWithContentUploading,
    dispatch,
    filteredEntities,
    t,
  ]);

  const publication = useMemo(() => {
    const baseResources = filteredEntities.map(({ id }) => {
      const url = isFolder
        ? constructPath(
            transformIdToRootEntityId(entity.id),
            id.replace(`${entity.id}/`, ''),
          )
        : transformIdToRootEntityId(id);

      return {
        action,
        sourceUrl: id,
        targetUrl: replaceIdWithBucket(
          action === PublishActions.DELETE ? id : url,
          PUBLIC_URL_PREFIX,
        ),
        reviewUrl: url,
        publishCredentials,
      };
    });

    const mappedWithConversationsFiles = transformFoldersFilesIds(
      filteredEntities as Conversation[],
      entity,
    );

    const fileResources =
      action === PublishActions.DELETE
        ? []
        : filteredConversationFiles.map(({ id }) => {
            const decodedId = ApiUtils.decodeApiUrl(id);

            const url =
              (isFolder
                ? mappedWithConversationsFiles.find(
                    (file) => file.oldUrl === decodedId,
                  )?.newUrl
                : transformIdToRootEntityId(decodedId)) ??
              transformIdToRootEntityId(decodedId);

            return {
              action: PublishActions.ADD_IF_ABSENT,
              sourceUrl: decodedId,
              reviewUrl: decodedId,
              targetUrl: replaceIdWithBucket(url, PUBLIC_URL_PREFIX),
            };
          });

    const decodedIconUrl = entity.iconUrl
      ? ApiUtils.decodeApiUrl(entity.iconUrl)
      : '';
    const targetIconUrl = transformIdToRootEntityId(decodedIconUrl);
    const iconResource =
      decodedIconUrl && !isFolder && action !== PublishActions.DELETE
        ? [
            {
              action: PublishActions.ADD_IF_ABSENT,
              sourceUrl: decodedIconUrl,
              reviewUrl: decodedIconUrl,
              targetUrl: replaceIdWithBucket(targetIconUrl, PUBLIC_URL_PREFIX),
            },
          ]
        : [];

    const resourceTypes = [
      resourceType,
      ...(isConversationId(entity.id) && action !== PublishActions.DELETE
        ? [BackendResourceType.FILE]
        : []),
    ];

    return {
      url: '',
      resources: [...baseResources, ...iconResource, ...fileResources],
      targetFolder:
        action === PublishActions.DELETE
          ? constructPath(
              PUBLIC_URL_PREFIX,
              getFolderIdFromEntityId(getIdWithoutRootPathSegments(entity.id)),
            )
          : PUBLIC_URL_PREFIX,
      resourceTypes,
      createdAt: entity.createdAt ?? 0,
      publicationStatus: PublicationStatus.PENDING,
    };
  }, [
    filteredEntities,
    action,
    filteredConversationFiles,
    entity,
    isFolder,
    resourceType,
    publishCredentials
  ]);

  useEffect(() => {
    if (publication.resources.length) {
      dispatch(
        PublicationActions.setPublicationItems({
          publicationUrl: '',
          ids: publication.resources.map((r) => r.reviewUrl),
        }),
      );
    }
  }, [dispatch, publication.resources, publishCredentials]);

  return <PublicationHandler publication={publication} />;
};

const PublishDialogView = () => {
  const dispatch = useAppDispatch();

  const { entity, action, isFolder, publishCredentials } = useAppSelector(
    PublicationSelectors.selectPublishModel,
  )!;
  const conversationFiles = useAppSelector((state) =>
    ConversationsSelectors.getAttachments(state, entity.id, NotReplayFilter),
  );

  const filteredConversationFiles = useMemo(() => {
    return action === PublishActions.DELETE
      ? conversationFiles.filter((file) => isEntityIdPublic(file))
      : conversationFiles;
  }, [conversationFiles, action]);

  const handleClose = useCallback(() => {
    dispatch(PublicationActions.setPublishModel());
  }, [dispatch]);

  const resourceType = EnumMapper.getBackendResourceTypeByApiKey(
    splitEntityId(entity.id).apiKey,
  );

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      onClose={handleClose}
      dataQa="publish-dialog"
      containerClassName="flex md:h-[747px] z-40 min-w-full max-w-[1100px] md:min-w-[550px] lg:min-w-[1000px] xl:w-[1000px]"
    >
      <PublishDialogContainer
        entity={entity}
        action={action}
        resourceType={resourceType}
        publishCredentials={publishCredentials ?? false}
        isFolder={!!isFolder}
        filteredConversationFiles={filteredConversationFiles}
      />
    </Modal>
  );
};

export const PublishDialog = withRenderWhen(
  PublicationSelectors.selectPublishModel,
)(PublishDialogView);
