import { useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import { AdditionalItemData, FeatureType } from '@/src/types/common';
import { PublicationResource } from '@/src/types/publication';

import { ConversationsActions, PromptsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PromptsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { ConversationComponent } from '@/src/components/Chatbar/Conversation';
import { Folder } from '@/src/components/Folder/Folder';
import { PromptComponent } from '@/src/components/Promptbar/components/Prompt';

import { UploadStatus } from '@epam/ai-dial-shared';

interface Props {
  resources: PublicationResource[];
  publicationUrl: string;
  isOpen: boolean;
  additionalItemData: AdditionalItemData;
}

export const PromptPublicationSidebarResources = ({
  resources,
  publicationUrl,
  isOpen,
  additionalItemData,
}: Props) => {
  const dispatch = useAppDispatch();

  const openedFolderIdsSelector = useMemo(
    () => UISelectors.selectOpenedFoldersIds(FeatureType.Prompt),
    [],
  );

  const openedFoldersIds = useAppSelector(openedFolderIdsSelector);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);
  const { isSelectedPromptApproveRequiredResource } = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  const {
    rootPublicationFolders,
    itemsToDisplay,
    folderItemsToDisplay,
    allPublicationFolders,
  } = usePublicationResources(allFolders, resources, prompts);

  const handleFolderClick = useCallback(
    (folderId: string) => {
      dispatch(PromptsActions.toggleFolder({ id: folderId }));

      const folder = allPublicationFolders.find((f) => f.id === folderId);
      if (folder?.status !== UploadStatus.LOADED) {
        dispatch(
          PromptsActions.uploadPromptsWithFoldersRecursive({
            path: folderId,
            noLoader: true,
          }),
        );
      }
    },
    [dispatch, allPublicationFolders],
  );

  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      dispatch(
        PromptsActions.updateFolder({
          publicationUrl,
          folderId,
          values: {
            name: newName,
          },
        }),
      );
    },
    [dispatch, publicationUrl],
  );

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootPublicationFolders.map((folder) => (
        <Folder
          key={folder.id}
          level={1}
          currentFolder={folder}
          allFolders={allPublicationFolders}
          searchTerm={searchTerm}
          openedFoldersIds={openedFoldersIds}
          allItems={folderItemsToDisplay}
          itemComponent={PromptComponent}
          onClickFolder={handleFolderClick}
          featureType={FeatureType.Prompt}
          onRenameFolder={handleRenameFolder}
          highlightedFolders={
            !isSelectedPromptApproveRequiredResource
              ? undefined
              : highlightedFolders
          }
          additionalItemData={additionalItemData}
        />
      ))}
      {itemsToDisplay.map((prompt) => (
        <PromptComponent
          key={prompt.id}
          item={prompt}
          level={1}
          additionalItemData={additionalItemData}
        />
      ))}
    </div>
  );
};

export const ConversationPublicationSidebarResources = ({
  resources,
  publicationUrl,
  isOpen,
  additionalItemData,
}: Props) => {
  const dispatch = useAppDispatch();

  const openedFolderIdsSelector = useMemo(
    () => UISelectors.selectOpenedFoldersIds(FeatureType.Chat),
    [],
  );

  const openedFoldersIds = useAppSelector(openedFolderIdsSelector);
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const {
    rootPublicationFolders,
    itemsToDisplay,
    folderItemsToDisplay,
    allPublicationFolders,
  } = usePublicationResources(allFolders, resources, conversations);

  const handleFolderClick = useCallback(
    (folderId: string) => {
      dispatch(ConversationsActions.toggleFolder({ id: folderId }));

      const folder = allPublicationFolders.find((f) => f.id === folderId);
      if (folder?.status !== UploadStatus.LOADED) {
        dispatch(
          ConversationsActions.uploadConversationsWithFoldersRecursive({
            path: folderId,
            noLoader: true,
          }),
        );
      }
    },
    [dispatch, allPublicationFolders],
  );

  const handleRenameFolder = useCallback(
    (newName: string, folderId: string) => {
      dispatch(
        ConversationsActions.updateFolder({
          publicationUrl,
          folderId,
          values: {
            name: newName,
          },
        }),
      );
    },
    [dispatch, publicationUrl],
  );

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootPublicationFolders.map((folder) => (
        <Folder
          key={folder.id}
          level={1}
          currentFolder={folder}
          allFolders={allPublicationFolders}
          searchTerm={searchTerm}
          openedFoldersIds={openedFoldersIds}
          allItems={folderItemsToDisplay}
          itemComponent={ConversationComponent}
          onClickFolder={handleFolderClick}
          featureType={FeatureType.Chat}
          onRenameFolder={handleRenameFolder}
          highlightedFolders={highlightedFolders}
          additionalItemData={additionalItemData}
        />
      ))}
      {itemsToDisplay.map((conversation) => (
        <ConversationComponent
          additionalItemData={additionalItemData}
          key={conversation.id}
          item={conversation}
          level={1}
        />
      ))}
    </div>
  );
};
