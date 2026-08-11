import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { sortByName } from '@/src/utils/app/folders';
import { getConversationRootId, isEntityIdExternal } from '@/src/utils/app/id';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
} from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
import {
  DraggedInterface,
  FolderInterface,
  FolderSectionProps,
} from '@/src/types/folder';
import { EntityFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import {
  ConversationsActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  PublicationSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { MAX_FOLDERS_DEPTH } from '@/src/constants/folders';
import { ChatI18nKeys } from '@/src/constants/i18n';
import { CHAT_PANEL_PUBLICATION_FEATURE_TYPES } from '@/src/constants/publication';
import {
  APPROVE_REQUIRED_SECTION_NAME,
  ORGANIZATION_SECTION_NAME,
  PINNED_CONVERSATIONS_SECTION_NAME,
  SHARED_WITH_ME_SECTION_NAME,
} from '@/src/constants/sections';

import { ApproveRequiredSection } from '@/src/components/Chat/Publish/ApproveRequiredSection';
import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { Folder } from '@/src/components/Folder/Folder';
import { BetweenFoldersLine } from '@/src/components/Sidebar/BetweenFoldersLine';

import { ConversationComponent } from './Conversation';

interface ChatFolderProps {
  folder: FolderInterface;
  isLast: boolean;
  readonly?: boolean;
  filters: EntityFilters;
  includeEmpty: boolean;
}

const publicationFeatureTypes = CHAT_PANEL_PUBLICATION_FEATURE_TYPES;

const ChatFolderTemplate = ({
  folder,
  isLast,
  readonly,
  filters,
  includeEmpty = false,
}: ChatFolderProps) => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const selectFilteredConversationsSelector = useMemo(
    () =>
      ConversationsSelectors.selectFilteredConversations(filters, searchTerm),
    [filters, searchTerm],
  );
  const conversations = useAppSelector(selectFilteredConversationsSelector);
  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);
  const selectFilteredFoldersSelector = useMemo(
    () =>
      ConversationsSelectors.selectFilteredFolders(
        filters,
        searchTerm,
        includeEmpty,
      ),
    [filters, includeEmpty, searchTerm],
  );

  const conversationFolders = useAppSelector(selectFilteredFoldersSelector);
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const openedFolderIdsSelector = useMemo(
    () => UISelectors.selectOpenedFoldersIds(FeatureType.Chat),
    [],
  );

  const openedFoldersIds = useAppSelector(openedFolderIdsSelector);
  const loadingFolderIds = useAppSelector(
    ConversationsSelectors.selectLoadingFolderIds,
  );
  const isSelectMode = useAppSelector(
    ConversationsSelectors.selectIsSelectMode,
  );
  const isConversationsStreaming = useAppSelector(
    ConversationsSelectors.selectIsConversationsStreaming,
  );

  const chosenFolderIdsSelector = useMemo(
    () => ConversationsSelectors.selectChosenFolderIds(conversations),
    [conversations],
  );

  const { fullyChosenFolderIds, partialChosenFolderIds } = useAppSelector(
    chosenFolderIdsSelector,
  );
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedItems,
  );
  const emptyFoldersIds = useAppSelector(
    ConversationsSelectors.selectEmptyFolderIds,
  );
  const isFolderEmpty = useAppSelector((state) =>
    ConversationsSelectors.selectIsFolderEmpty(state, folder.id),
  );

  const additionalFolderData = useMemo(
    () => ({
      selectedFolderIds: fullyChosenFolderIds,
      partialSelectedFolderIds: partialChosenFolderIds,
      isSidePanelItem: true,
    }),
    [fullyChosenFolderIds, partialChosenFolderIds],
  );

  const handleDrop = useCallback(
    (currentFolder: FolderInterface, draggedData: DraggedInterface) => {
      const { entity, isFolder } = draggedData;
      if (isFolder) {
        if (
          entity.id !== currentFolder.id &&
          entity.folderId !== currentFolder.id
        ) {
          dispatch(
            ConversationsActions.updateFolder({
              folderId: entity.id,
              values: { folderId: currentFolder.id, isShared: false },
            }),
          );
        }
      } else if (entity && entity.folderId !== currentFolder.id) {
        dispatch(
          ConversationsActions.updateConversation({
            id: entity.id,
            values: { folderId: currentFolder.id },
          }),
        );
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
          UIActions.showErrorToast({
            message: t(ChatI18nKeys.FolderNameExistsAtRoot, {
              ns: Translation.Chat,
              name: folder.name,
            }),
          }),
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
            resourceIds: [folder.id],
            isFolder: true,
            featureType: FeatureType.Chat,
          }),
        );
      } else if (folder.isShared) {
        dispatch(
          ConversationsActions.deleteFolder({
            folderId,
          }),
        );
      } else {
        dispatch(ConversationsActions.deleteFolder({ folderId }));
      }
    },
    [dispatch, folder.id, folder.isShared, folder.sharedWithMe],
  );

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      if (isFolderEmpty) {
        dispatch(
          ConversationsActions.addToChosenEmptyFolders({ ids: [folderId] }),
        );
      } else {
        dispatch(
          ConversationsActions.setChosenConversations({
            ids: conversations
              .filter(
                (c) =>
                  c.id.startsWith(folderId) &&
                  (!partialChosenFolderIds.includes(folderId) ||
                    !selectedConversations.includes(c.id)),
              )
              .map((e) => e.id),
          }),
        );
        dispatch(
          ConversationsActions.addToChosenEmptyFolders({
            ids: emptyFoldersIds
              .filter((id) => `${id}/`.startsWith(folderId))
              .map((id) => `${id}/`),
          }),
        );
      }
    },
    [
      conversations,
      dispatch,
      emptyFoldersIds,
      isFolderEmpty,
      partialChosenFolderIds,
      selectedConversations,
    ],
  );

  const shouldDenyDrop =
    isEntityIdExternal(folder) || isSelectMode || isConversationsStreaming;

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        featureType={FeatureType.Chat}
        denyDrop={shouldDenyDrop}
      />
      <Folder
        maxDepth={MAX_FOLDERS_DEPTH}
        readonly={readonly || isConversationsStreaming}
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={ConversationComponent}
        allItems={conversations}
        allItemsWithoutFilters={allConversations}
        allFolders={conversationFolders}
        allFoldersWithoutFilters={allFolders}
        highlightedFolders={highlightedFolders}
        openedFoldersIds={openedFoldersIds}
        handleDrop={!shouldDenyDrop ? handleDrop : undefined}
        onRenameFolder={handleFolderRename}
        onUnshareFolder={handleFolderDelete}
        onDeleteFolder={handleFolderDelete}
        onClickFolder={handleFolderClick}
        featureType={FeatureType.Chat}
        loadingFolderIds={loadingFolderIds}
        onSelectFolder={handleFolderSelect}
        canSelectFolders={!isConversationsStreaming && isSelectMode}
        additionalItemData={additionalFolderData}
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          featureType={FeatureType.Chat}
          denyDrop={shouldDenyDrop}
        />
      )}
    </>
  );
};

const ChatSection = ({
  name,
  filters,
  hideIfEmpty = true,
  displayRootFiles,
  showEmptyFolders = false,
  openByDefault,
  dataQa,
}: FolderSectionProps) => {
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);
  const { t } = useTranslation(Translation.Chat);

  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const selectFilteredFoldersSelector = useMemo(
    () =>
      ConversationsSelectors.selectFilteredFolders(
        filters,
        searchTerm,
        showEmptyFolders,
      ),
    [filters, searchTerm, showEmptyFolders],
  );
  const rootFolders = useAppSelector(selectFilteredFoldersSelector);
  const selectFilteredConversationsSelector = useMemo(
    () =>
      ConversationsSelectors.selectFilteredConversations(filters, searchTerm),
    [filters, searchTerm],
  );
  const rootConversations = useAppSelector(selectFilteredConversationsSelector);
  const selectedFoldersIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const { handleToggle, isExpanded } = useSectionToggle(name, FeatureType.Chat);

  const additionalConvData = useMemo(
    () => ({
      isSidePanelItem: true,
    }),
    [],
  );

  const sortedRootConversations = useMemo(
    () => sortByName(rootConversations),
    [rootConversations],
  );

  const folderTemplateFilters = useMemo(
    () => ({
      searchFilter: filters.searchFilter,
      versionFilter: filters.versionFilter,
    }),
    [filters.searchFilter, filters.versionFilter],
  );

  useEffect(() => {
    const shouldBeHighlighted =
      rootFolders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
      (!!displayRootFiles &&
        sortedRootConversations.some((conv) =>
          selectedConversationsIds.includes(conv.id),
        ));
    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    rootFolders,
    isSectionHighlighted,
    selectedConversationsIds,
    selectedFoldersIds,
    rootConversations,
    sortedRootConversations,
  ]);

  if (
    hideIfEmpty &&
    (!displayRootFiles || !rootConversations.length) &&
    !rootFolders.length
  ) {
    return null;
  }

  const isOrganizationAndPublicationSelected =
    name === ORGANIZATION_SECTION_NAME && selectedPublication;

  return (
    <CollapsibleSection
      onToggle={handleToggle}
      name={t(name)}
      openByDefault={openByDefault ?? isExpanded}
      isExpanded={isExpanded}
      dataQa={dataQa}
      isHighlighted={
        isOrganizationAndPublicationSelected ? false : isSectionHighlighted
      }
    >
      <div>
        {rootFolders.map((folder, index, arr) => {
          return (
            <ChatFolderTemplate
              key={folder.id}
              folder={folder}
              isLast={index === arr.length - 1}
              filters={folderTemplateFilters}
              includeEmpty={showEmptyFolders}
            />
          );
        })}
      </div>
      {displayRootFiles && (
        <div className="flex flex-col gap-1">
          {sortedRootConversations.map((item) => (
            <ConversationComponent
              additionalItemData={additionalConvData}
              key={item.id}
              item={item}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
};

export function ChatFolders() {
  const isFilterEmpty = useAppSelector(
    ConversationsSelectors.selectIsEmptySearchFilter,
  );
  const commonItemFilter = useAppSelector(
    ConversationsSelectors.selectMyItemsFilters,
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Chat),
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Chat),
  );
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);

  const publicationItemsSelector = useMemo(
    () =>
      PublicationSelectors.selectFilteredPublicationsWithSearch(
        publicationFeatureTypes,
        true,
        searchTerm,
      ),
    [searchTerm],
  );

  const publicationItems = useAppSelector(publicationItemsSelector);

  const toApproveFolderItem = useMemo(
    () => ({
      hidden: !publicationItems.length,
      name: APPROVE_REQUIRED_SECTION_NAME,
      displayRootFiles: true,
      dataQa: 'approve-required',
    }),
    [publicationItems.length],
  );

  const folderItems: FolderSectionProps[] = useMemo(
    () =>
      [
        {
          hidden: !isPublishingEnabled || !isFilterEmpty,
          name: ORGANIZATION_SECTION_NAME,
          filters: PublishedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'published-with-me',
        },
        {
          hidden: !isSharingEnabled || !isFilterEmpty,
          name: SHARED_WITH_ME_SECTION_NAME,
          filters: SharedWithMeFilters,
          displayRootFiles: true,
          dataQa: 'shared-with-me',
        },
        {
          name: PINNED_CONVERSATIONS_SECTION_NAME,
          filters: commonItemFilter,
          showEmptyFolders: isFilterEmpty,
          dataQa: 'pinned-chats',
        },
      ].filter(({ hidden }) => !hidden),
    [commonItemFilter, isFilterEmpty, isPublishingEnabled, isSharingEnabled],
  );

  return (
    <div
      className="flex w-full flex-col gap-0.5 divide-y divide-tertiary empty:hidden"
      data-qa="chat-folders"
    >
      {!toApproveFolderItem.hidden && (
        <ApproveRequiredSection
          featureTypes={publicationFeatureTypes}
          publicationItems={publicationItems}
          {...toApproveFolderItem}
        />
      )}
      {folderItems.map((itemProps) => (
        <ChatSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
