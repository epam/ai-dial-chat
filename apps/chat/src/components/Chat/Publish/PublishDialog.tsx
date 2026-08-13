import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { extractNameFromEmail } from '@/src/utils/app/common';
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
  buildDedupedPublicationFileTargetsFromConversations,
  createPublicationIconTargetUrl,
  isEntityIdPublic,
} from '@/src/utils/app/publications';
import { NotReplayFilter } from '@/src/utils/app/search';
import {
  constructPath,
  isMyEntity,
  splitEntityId,
} from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { BackendResourceType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { ModalState } from '@/src/types/modal';
import {
  Publication,
  PublicationModel,
  PublicationStatus,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PublicationActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  ConversationsSelectors,
  PromptsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { Modal } from '@/src/components/Common/Modal';

import { CreatePublicationHandler } from './PublicationHandler/CreatePublicationHandler';

import { Conversation, PublishActions } from '@epam/ai-dial-shared';

interface PublishDialogContainerProps {
  publicationModel: PublicationModel;
  resourceType: BackendResourceType;
  filteredConversationFiles: DialFile[];
}

const PublishDialogContainer = ({
  publicationModel,
  resourceType,
  filteredConversationFiles,
}: PublishDialogContainerProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const { entity, isFolder, action, publishCredentials } = publicationModel;
  const memoizedEntityArray = useMemo(() => [entity], [entity]);

  const areConversationsWithContentUploading = useAppSelector(
    ConversationsSelectors.selectAreConversationsWithContentUploading,
  );
  const userName = useAppSelector(AuthSelectors.selectUserEmail);
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
        UIActions.showErrorToast({
          message: t(ChatI18nKeys.NoValidItemsToPublish),
        }),
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

  const publication: Publication = useMemo(() => {
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
        publishCredentials: publishCredentials ?? false,
      };
    });

    const mappedWithConversationsFiles =
      buildDedupedPublicationFileTargetsFromConversations(
        filteredEntities as Conversation[],
        entity.folderId,
        isFolder,
      );

    const fileResources =
      action === PublishActions.DELETE
        ? []
        : isFolder
          ? mappedWithConversationsFiles.map(({ oldUrl, newUrl }) => ({
              action: PublishActions.ADD_IF_ABSENT,
              sourceUrl: oldUrl,
              reviewUrl: newUrl,
              targetUrl: replaceIdWithBucket(newUrl, PUBLIC_URL_PREFIX),
            }))
          : filteredConversationFiles.map(({ id }) => {
              const decodedId = ApiUtils.decodeApiUrl(id);

              const url = transformIdToRootEntityId(decodedId);

              return {
                action: PublishActions.ADD_IF_ABSENT,
                sourceUrl: decodedId,
                reviewUrl: decodedId,
                targetUrl: replaceIdWithBucket(url, PUBLIC_URL_PREFIX),
              };
            });

    const iconResource = [];
    if (
      entity.iconUrl &&
      action !== PublishActions.DELETE &&
      isMyEntity({ id: entity.iconUrl })
    ) {
      const decodedIconUrl = ApiUtils.decodeApiUrl(entity.iconUrl);

      iconResource.push({
        action: PublishActions.ADD_IF_ABSENT,
        sourceUrl: decodedIconUrl,
        reviewUrl: decodedIconUrl,
        targetUrl: createPublicationIconTargetUrl({
          entityId: entity.id,
          iconUrl: decodedIconUrl,
          targetFolder: PUBLIC_URL_PREFIX,
        }),
      });
    }

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
      displayAuthor: extractNameFromEmail(userName),
    };
  }, [
    filteredEntities,
    entity.folderId,
    entity.iconUrl,
    entity.id,
    entity.createdAt,
    action,
    filteredConversationFiles,
    resourceType,
    userName,
    isFolder,
    publishCredentials,
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

  return (
    <CreatePublicationHandler
      publication={publication}
      publicationModel={publicationModel}
    />
  );
};

interface PublishDialogViewProps {
  publicationModel: PublicationModel;
}

const PublishDialogView = ({ publicationModel }: PublishDialogViewProps) => {
  const dispatch = useAppDispatch();

  const conversationFiles = useAppSelector((state) =>
    ConversationsSelectors.getAttachments(
      state,
      publicationModel.entity.id,
      NotReplayFilter,
    ),
  );

  const filteredConversationFiles = useMemo(() => {
    return publicationModel.action === PublishActions.DELETE
      ? conversationFiles.filter((file) => isEntityIdPublic(file))
      : conversationFiles;
  }, [conversationFiles, publicationModel.action]);

  const handleClose = useCallback(() => {
    dispatch(PublicationActions.setPublishModel());
  }, [dispatch]);

  const resourceType = EnumMapper.getBackendResourceTypeByApiKey(
    splitEntityId(publicationModel.entity.id).apiKey,
  );

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      onClose={handleClose}
      dataQa="publish-dialog"
      containerClassName="flex md:h-[747px] z-40 min-w-full max-w-[1100px] md:min-w-[550px] lg:min-w-[1200px] xl:w-[1200px]"
    >
      <PublishDialogContainer
        publicationModel={publicationModel}
        resourceType={resourceType}
        filteredConversationFiles={filteredConversationFiles}
      />
    </Modal>
  );
};

export function PublishDialog() {
  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );

  if (!publicationModel) return null;

  return <PublishDialogView publicationModel={publicationModel} />;
}
