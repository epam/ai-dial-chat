import { DragEvent, useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getConversationRootId } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH } from '@/src/constants/folders';

import Folder from '@/src/components/Folder/Folder';

import { BetweenFoldersLine } from '../Sidebar/BetweenFoldersLine';
import { ChatFolderProps } from './ChatFolders';
import { ConversationComponent } from './Conversation';

export const ChatFolderTemplate = ({
  folder,
  isLast,
  readonly,
  filters,
  includeEmpty = false,
}: ChatFolderProps) => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredConversations(
      state,
      filters,
      searchTerm,
    ),
  );
  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);
  const conversationFolders = useAppSelector((state) =>
    ConversationsSelectors.selectFilteredFolders(
      state,
      filters,
      searchTerm,
      includeEmpty,
    ),
  );
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );
  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const loadingFolderIds = useAppSelector(
    ConversationsSelectors.selectLoadingFolderIds,
  );
  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, folder, FeatureType.Chat),
  );
  const isSelectMode = useAppSelector(
    ConversationsSelectors.selectIsSelectMode,
  );
  const selectedFolderIds = useAppSelector((state) =>
    ConversationsSelectors.selectChosenFolderIds(state, conversations),
  );
  const partialSelectedFolderIds = useAppSelector((state) =>
    ConversationsSelectors.selectPartialChosenFolderIds(state, conversations),
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedItems,
  );

  const handleDrop = useCallback(
    (e: DragEvent, folder: FolderInterface) => {
      if (e.dataTransfer) {
        const conversationData = e.dataTransfer.getData(MoveType.Conversation);
        const folderData = e.dataTransfer.getData(MoveType.ConversationFolder);

        if (conversationData) {
          const conversation: Conversation = JSON.parse(conversationData);
          dispatch(
            ConversationsActions.updateConversation({
              id: conversation.id,
              values: {
                folderId: folder.id,
              },
            }),
          );
        } else if (folderData) {
          const movedFolder: FolderInterface = JSON.parse(folderData);
          if (
            movedFolder.id !== folder.id &&
            movedFolder.folderId !== folder.id
          ) {
            dispatch(
              ConversationsActions.updateFolder({
                folderId: movedFolder.id,
                values: { folderId: folder.id },
              }),
            );
          }
        }
      }
    },
    [dispatch],
  );
  const onDropBetweenFolders = useCallback(
    (folder: FolderInterface) => {
      const folderId = getConversationRootId();

      if (
        !isEntityNameOnSameLevelUnique(
          folder.name,
          { ...folder, folderId },
          allFolders,
        )
      ) {
        dispatch(
          UIActions.showErrorToast(
            t('Folder with name "{{name}}" already exists at the root.', {
              ns: 'folder',
              name: folder.name,
            }),
          ),
        );

        return;
      }

      dispatch(
        ConversationsActions.updateFolder({
          folderId: folder.id,
          values: { folderId },
        }),
      );
    },
    [allFolders, dispatch, t],
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      dispatch(ConversationsActions.toggleFolder({ id: folderId }));
    },
    [dispatch],
  );

  const handleFolderRename = useCallback(
    (name: string, folderId: string) => {
      dispatch(
        ConversationsActions.updateFolder({
          folderId,
          values: { name, isShared: false },
        }),
      );
    },
    [dispatch],
  );

  const handleFolderDelete = useCallback(
    (folderId: string) => {
      if (folder.sharedWithMe) {
        dispatch(
          ShareActions.discardSharedWithMe({
            resourceId: folder.id,
            isFolder: true,
            featureType: FeatureType.Chat,
          }),
        );
      } else {
        dispatch(ConversationsActions.deleteFolder({ folderId }));
      }
    },
    [dispatch, folder.id, folder.sharedWithMe],
  );

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      dispatch(
        ConversationsActions.setChosenConversations({
          ids: conversations
            .filter((c) =>
              c.id.startsWith(folderId) &&
              !partialSelectedFolderIds.includes(folderId)
                ? selectedConversations.includes(c.id)
                : !selectedConversations.includes(c.id),
            )
            .map((e) => e.id),
        }),
      );
    },
    [conversations, dispatch, partialSelectedFolderIds],
  );

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        featureType={FeatureType.Chat}
        denyDrop={isExternal || isSelectMode}
      />
      <Folder
        maxDepth={MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH}
        readonly={readonly}
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={ConversationComponent}
        allItems={conversations}
        allItemsWithoutFilters={allConversations}
        allFolders={conversationFolders}
        allFoldersWithoutFilters={allFolders}
        highlightedFolders={highlightedFolders}
        openedFoldersIds={openedFoldersIds}
        handleDrop={handleDrop}
        onRenameFolder={handleFolderRename}
        onDeleteFolder={handleFolderDelete}
        onClickFolder={handleFolderClick}
        featureType={FeatureType.Chat}
        loadingFolderIds={loadingFolderIds}
        onSelectFolder={handleFolderSelect}
        canSelectFolders={isSelectMode}
        additionalItemData={{
          selectedFolderIds,
          partialSelectedFolderIds,
        }}
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          featureType={FeatureType.Chat}
          denyDrop={isExternal || isSelectMode}
        />
      )}
    </>
  );
};
