import { IconDownload } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import { constructPath } from '@/src/utils/app/file';
import { ApiUtils } from '@/src/utils/server/api';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { PublicationResource } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { NA_VERSION } from '@/src/constants/public';

import { PromptComponent } from '../../Promptbar/components/Prompt';

import { ConversationComponent } from '../../Chatbar/Conversation';
import {
  ApplicationRow,
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '../../Common/ReplaceConfirmationModal/Components';
import { FileItem } from '../../Files/FileItem';
import Folder from '../../Folder/Folder';
import { PublicVersionSelector } from './PublicVersionSelector';

import {
  PublishActions,
  ShareEntity,
  UploadStatus,
} from '@epam/ai-dial-shared';

interface PublicationResourcesVersionGroupInterface {
  entity: ShareEntity;
}

const PublicationResourcesVersionGroup = ({
  entity,
}: PublicationResourcesVersionGroupInterface) => {
  const { t } = useTranslation(Translation.Chat);

  const { publicVersionGroupId } = usePublicVersionGroupId(entity);

  if (!publicVersionGroupId) {
    return null;
  }

  return (
    <PublicVersionSelector
      publicVersionGroupId={publicVersionGroupId}
      textBeforeSelector={t('Last: ')}
      btnClassNames="shrink-0"
      groupVersions={entity.publicationInfo?.action !== PublishActions.DELETE}
      readonly
    />
  );
};

interface PublicationResources {
  resources: PublicationResource[];
  readonly?: boolean;
  showTooltip?: boolean;
  isOpen?: boolean;
  additionalItemData?: AdditionalItemData;
}

export const PromptPublicationResources = ({
  resources,
  readonly,
  showTooltip,
  isOpen = true,
  additionalItemData,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Prompt),
  );
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);
  const { isSelectedPromptApproveRequiredResource } = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, prompts);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.map((f) => (
        <Folder
          readonly
          key={f.id}
          noCaretIcon={!!readonly}
          level={readonly ? 0 : 1}
          currentFolder={f}
          allFolders={allFolders.filter((f) =>
            folderItemsToDisplay.some((item) => item.id.startsWith(`${f.id}/`)),
          )}
          searchTerm={readonly ? '' : searchTerm}
          openedFoldersIds={
            readonly ? allFolders.map((f) => f.id) : openedFoldersIds
          }
          allItems={folderItemsToDisplay}
          itemComponent={({ item: prompt, ...props }) =>
            readonly ? (
              <div
                className="flex items-center justify-between gap-4"
                key={prompt.id}
              >
                <PromptsRow
                  {...props}
                  item={prompt}
                  featureContainerClassNames="w-full"
                  itemComponentClassNames={classNames(
                    'w-full truncate',
                    readonly && 'cursor-pointer',
                  )}
                />
                <div className="flex shrink-0 items-center gap-2">
                  {prompt.publicationInfo?.action !== PublishActions.DELETE && (
                    <PublicationResourcesVersionGroup entity={prompt} />
                  )}
                  <span
                    className={classNames(
                      'text-xs',
                      prompt.publicationInfo?.action ===
                        PublishActions.DELETE && 'text-error',
                    )}
                    data-qa="version"
                  >
                    {prompt.publicationInfo?.version || NA_VERSION}
                  </span>
                </div>
              </div>
            ) : (
              <PromptComponent {...props} item={prompt} />
            )
          }
          onClickFolder={(folderId) => {
            if (readonly) return;
            dispatch(PromptsActions.toggleFolder({ id: folderId }));

            if (f.status !== UploadStatus.LOADED) {
              dispatch(
                PromptsActions.uploadPromptsWithFoldersRecursive({
                  path: folderId,
                  noLoader: true,
                }),
              );
            }
          }}
          featureType={FeatureType.Prompt}
          highlightedFolders={
            !isSelectedPromptApproveRequiredResource || readonly
              ? undefined
              : highlightedFolders
          }
          folderClassName={classNames(readonly && 'h-[38px]')}
          showTooltip={showTooltip}
          additionalItemData={additionalItemData}
        />
      ))}
      {itemsToDisplay.map((prompt) =>
        readonly ? (
          <div
            className="flex items-center justify-between gap-4"
            key={prompt.id}
          >
            <PromptsRow
              featureContainerClassNames="w-full"
              itemComponentClassNames="w-full cursor-pointer truncate"
              key={prompt.id}
              item={prompt}
              level={0}
            />
            <div className="flex shrink-0 items-center gap-2">
              {prompt.publicationInfo?.action !== PublishActions.DELETE && (
                <PublicationResourcesVersionGroup entity={prompt} />
              )}
              <span
                className={classNames(
                  'text-xs',
                  prompt.publicationInfo?.action === PublishActions.DELETE &&
                    'text-error',
                )}
                data-qa="version"
              >
                {prompt.publicationInfo?.version || NA_VERSION}
              </span>
            </div>
          </div>
        ) : (
          <PromptComponent
            key={prompt.id}
            item={prompt}
            level={1}
            additionalItemData={additionalItemData}
          />
        ),
      )}
    </div>
  );
};

export const ConversationPublicationResources = ({
  resources,
  readonly,
  showTooltip,
  isOpen = true,
  additionalItemData,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, conversations);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.map((f) => (
        <Folder
          readonly
          key={f.id}
          noCaretIcon={!!readonly}
          level={readonly ? 0 : 1}
          currentFolder={f}
          allFolders={allFolders.filter((f) =>
            folderItemsToDisplay.some((item) => item.id.startsWith(`${f.id}/`)),
          )}
          searchTerm={readonly ? '' : searchTerm}
          openedFoldersIds={
            readonly ? allFolders.map((f) => f.id) : openedFoldersIds
          }
          allItems={folderItemsToDisplay}
          itemComponent={({ item: conv, ...props }) =>
            readonly ? (
              <div
                className="flex items-center justify-between gap-4"
                key={conv.id}
              >
                <ConversationRow
                  {...props}
                  item={conv}
                  featureContainerClassNames="w-full"
                  itemComponentClassNames={classNames(
                    'w-full truncate',
                    readonly && 'cursor-pointer',
                  )}
                />
                <div className="flex shrink-0 items-center gap-2">
                  {conv.publicationInfo?.action !== PublishActions.DELETE && (
                    <PublicationResourcesVersionGroup entity={conv} />
                  )}
                  <span
                    className={classNames(
                      'text-xs',
                      conv.publicationInfo?.action === PublishActions.DELETE &&
                        'text-error',
                    )}
                    data-qa="version"
                  >
                    {conv.publicationInfo?.version || NA_VERSION}
                  </span>
                </div>
              </div>
            ) : (
              <ConversationComponent {...props} item={conv} />
            )
          }
          onClickFolder={(folderId) => {
            if (readonly) return;
            dispatch(ConversationsActions.toggleFolder({ id: folderId }));

            if (f.status !== UploadStatus.LOADED) {
              dispatch(
                ConversationsActions.uploadConversationsWithFoldersRecursive({
                  path: folderId,
                  noLoader: true,
                }),
              );
            }
          }}
          featureType={FeatureType.Chat}
          highlightedFolders={readonly ? undefined : highlightedFolders}
          folderClassName={classNames(readonly && 'h-[38px]')}
          additionalItemData={additionalItemData}
          showTooltip={showTooltip}
        />
      ))}
      {itemsToDisplay.map((conversation) =>
        readonly ? (
          <div
            className="flex items-center justify-between gap-4"
            key={conversation.id}
          >
            <ConversationRow
              featureContainerClassNames="w-full"
              itemComponentClassNames="w-full cursor-pointer truncate"
              item={conversation}
              level={0}
            />
            <div className="flex shrink-0 items-center gap-2">
              {conversation.publicationInfo?.action !==
                PublishActions.DELETE && (
                <PublicationResourcesVersionGroup entity={conversation} />
              )}
              <span
                className={classNames(
                  'text-xs',
                  conversation.publicationInfo?.action ===
                    PublishActions.DELETE && 'text-error',
                )}
                data-qa="version"
              >
                {conversation.publicationInfo?.version || NA_VERSION}
              </span>
            </div>
          </div>
        ) : (
          <ConversationComponent
            additionalItemData={additionalItemData}
            key={conversation.id}
            item={conversation}
            level={1}
          />
        ),
      )}
    </div>
  );
};

export const FilePublicationResources = ({
  resources,
  readonly,
  isOpen = true,
  showTooltip,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.File),
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, files);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.map((f) => (
        <Folder
          key={f.id}
          readonly
          noCaretIcon={!!readonly}
          displayCaretAlways
          level={readonly ? 0 : 1}
          currentFolder={f}
          allFolders={allFolders.filter((f) =>
            folderItemsToDisplay.some((item) => item.id.startsWith(`${f.id}/`)),
          )}
          searchTerm={''}
          openedFoldersIds={
            readonly ? allFolders.map((f) => f.id) : openedFoldersIds
          }
          allItems={folderItemsToDisplay}
          itemComponent={(props) =>
            readonly ? (
              <div key={props.item.id} className="flex items-center gap-2">
                <FilesRow
                  {...props}
                  itemComponentClassNames={classNames(
                    'w-full truncate',
                    readonly && 'cursor-pointer',
                  )}
                />
                <a
                  download={props.item.name}
                  href={constructPath(
                    'api',
                    ApiUtils.encodeApiUrl(props.item.id),
                  )}
                  data-qa="download"
                >
                  <IconDownload
                    className="shrink-0 text-secondary hover:text-accent-primary"
                    size={18}
                  />
                </a>
              </div>
            ) : (
              <FileItem {...props} />
            )
          }
          onClickFolder={(folderId) => {
            if (readonly) return;
            dispatch(FilesActions.getFolders({ id: folderId }));
          }}
          featureType={FeatureType.File}
          folderClassName={classNames(readonly && 'h-[38px]')}
          showTooltip={showTooltip}
        />
      ))}
      {itemsToDisplay.map((f) =>
        readonly ? (
          <div key={f.id} className="flex items-center gap-2">
            <FilesRow
              itemComponentClassNames="cursor-pointer w-full truncate"
              item={f}
              level={0}
            />
            <a
              download={f.name}
              href={constructPath('api', ApiUtils.encodeApiUrl(f.id))}
              data-qa="download"
            >
              <IconDownload
                className="shrink-0 text-secondary hover:text-accent-primary"
                size={18}
              />
            </a>
          </div>
        ) : (
          <FileItem key={f.id} item={f} level={1} />
        ),
      )}
    </div>
  );
};

export const ApplicationPublicationResources = ({
  isOpen = true,
  resources,
}: PublicationResources) => {
  const publishRequestModels = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );

  const filteredApps = useMemo(() => {
    const resourcesIds = resources.map((resource) => resource.reviewUrl);

    return publishRequestModels.filter((model) =>
      resourcesIds.includes(model.id),
    );
  }, [publishRequestModels, resources]);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {filteredApps.map((application) => (
        <ApplicationRow item={application} key={application.id} />
      ))}
    </div>
  );
};
