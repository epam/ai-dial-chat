import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { sortByName } from '@/src/utils/app/folders';
import { getPromptRootId } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
} from '@/src/utils/app/search';
import { isEntityOrParentsExternal } from '@/src/utils/app/share';

import { BackendResourceType, FeatureType } from '@/src/types/common';
import { FolderInterface, FolderSectionProps } from '@/src/types/folder';
import { PromptInfo } from '@/src/types/prompt';
import { EntityFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import {
  MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH,
  PUBLISHING_APPROVE_REQUIRED_NAME,
  PUBLISHING_FOLDER_NAME,
} from '@/src/constants/folders';

import Folder from '@/src/components/Folder/Folder';

import { ApproveRequiredSection } from '../../Chat/Publish/ApproveRequiredSection';
import CollapsibleSection from '../../Common/CollapsibleSection';
import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { PromptComponent } from './Prompt';

interface promptFolderProps {
  folder: FolderInterface;
  isLast: boolean;
  filters: EntityFilters;
  includeEmpty: boolean;
}

const PromptFolderTemplate = ({
  folder,
  isLast,
  filters,
  includeEmpty = false,
}: promptFolderProps) => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const prompts = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPrompts(state, filters, searchTerm),
  );
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);
  const promptFolders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredFolders(
      state,
      filters,
      searchTerm,
      includeEmpty,
    ),
  );
  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Prompt),
  );
  const loadingFolderIds = useAppSelector((state) =>
    PromptsSelectors.selectLoadingFolderIds(state),
  );

  const isExternal = useAppSelector((state) =>
    isEntityOrParentsExternal(state, folder, FeatureType.Prompt),
  );

  const handleDrop = useCallback(
    (e: DragEvent, folder: FolderInterface) => {
      if (e.dataTransfer) {
        const promptData = e.dataTransfer.getData(MoveType.Prompt);
        const folderData = e.dataTransfer.getData(MoveType.PromptFolder);

        if (promptData) {
          const prompt: PromptInfo = JSON.parse(promptData);
          dispatch(
            PromptsActions.updatePrompt({
              id: prompt.id,
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
              PromptsActions.updateFolder({
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
      const folderId = getPromptRootId();

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
        PromptsActions.updateFolder({
          folderId: folder.id,
          values: { folderId },
        }),
      );
    },
    [allFolders, dispatch, t],
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      dispatch(
        PromptsActions.toggleFolder({
          id: folderId,
        }),
      );
    },
    [dispatch],
  );

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        featureType={FeatureType.Prompt}
        denyDrop={isExternal}
      />
      <Folder
        maxDepth={MAX_CONVERSATION_AND_PROMPT_FOLDERS_DEPTH}
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={PromptComponent}
        allItems={prompts}
        allItemsWithoutFilters={allPrompts}
        allFolders={promptFolders}
        allFoldersWithoutFilters={allFolders}
        loadingFolderIds={loadingFolderIds}
        highlightedFolders={highlightedFolders}
        openedFoldersIds={openedFoldersIds}
        handleDrop={handleDrop}
        onRenameFolder={(name, folderId) => {
          dispatch(
            PromptsActions.updateFolder({
              folderId,
              values: { name },
            }),
          );
        }}
        onDeleteFolder={(folderId: string) => {
          if (folder.sharedWithMe) {
            dispatch(
              ShareActions.discardSharedWithMe({
                resourceId: folder.id,
                isFolder: true,
                featureType: FeatureType.Prompt,
              }),
            );
          } else {
            dispatch(PromptsActions.deleteFolder({ folderId }));
          }
        }}
        onClickFolder={handleFolderClick}
        featureType={FeatureType.Prompt}
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          featureType={FeatureType.Prompt}
          denyDrop={isExternal}
        />
      )}
    </>
  );
};

export const PromptSection = ({
  name,
  filters,
  hideIfEmpty = true,
  displayRootFiles,
  showEmptyFolders = false,
  openByDefault = false,
  dataQa,
}: FolderSectionProps) => {
  const { t } = useTranslation(Translation.PromptBar);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);
  const rootFolders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredFolders(
      state,
      filters,
      searchTerm,
      showEmptyFolders,
    ),
  );
  const prompts = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPrompts(state, filters, searchTerm),
  );

  const rootPrompts = useMemo(() => sortByName(prompts), [prompts]);

  const selectedFoldersIds = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );

  const selectSelectedPromptId = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  useEffect(() => {
    const shouldBeHighlighted =
      rootFolders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
      (!!displayRootFiles &&
        rootPrompts.some(({ id }) => selectSelectedPromptId === id));
    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    rootFolders,
    isSectionHighlighted,
    selectSelectedPromptId,
    selectedFoldersIds,
    rootPrompts,
  ]);

  if (
    hideIfEmpty &&
    (!displayRootFiles || !rootPrompts.length) &&
    !rootFolders.length
  ) {
    return null;
  }

  return (
    <CollapsibleSection
      name={t(name)}
      openByDefault={openByDefault}
      dataQa={dataQa}
      isHighlighted={isSectionHighlighted}
    >
      <div>
        {rootFolders.map((folder, index, arr) => (
          <PromptFolderTemplate
            key={folder.id}
            folder={folder}
            isLast={index === arr.length - 1}
            filters={{ searchFilter: filters.searchFilter }}
            includeEmpty={showEmptyFolders}
          />
        ))}
      </div>
      {displayRootFiles && (
        <div className="flex flex-col gap-1">
          {rootPrompts.map((item) => (
            <PromptComponent key={item.id} item={item} />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
};

export function PromptFolders() {
  const { t } = useTranslation(Translation.PromptBar);

  const isFilterEmpty = useAppSelector(
    PromptsSelectors.selectIsEmptySearchFilter,
  );
  const commonSearchFilter = useAppSelector(
    PromptsSelectors.selectMyItemsFilters,
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Prompt),
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, FeatureType.Prompt),
  );
  const publicationItems = useAppSelector((state) =>
    PublicationSelectors.selectFilteredPublications(
      state,
      BackendResourceType.PROMPT,
    ),
  );

  const toApproveFolderItem = {
    hidden: !publicationItems.length,
    name: t(PUBLISHING_APPROVE_REQUIRED_NAME),
    displayRootFiles: true,
    dataQa: 'approve-required',
    openByDefault: true,
  };

  const folderItems: FolderSectionProps[] = useMemo(
    () =>
      [
        {
          hidden: !isPublishingEnabled || !isFilterEmpty,
          name: t(PUBLISHING_FOLDER_NAME),
          filters: PublishedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'published-with-me',
          openByDefault: true,
        },
        {
          hidden: !isSharingEnabled || !isFilterEmpty,
          name: t('Shared with me'),
          filters: SharedWithMeFilters,
          ignoreRootFilter: true,
          displayRootFiles: true,
          dataQa: 'shared-with-me',
          openByDefault: true,
        },
        {
          name: t('Pinned prompts'),
          filters: commonSearchFilter,
          showEmptyFolders: isFilterEmpty,
          openByDefault: true,
          dataQa: 'pinned-prompts',
        },
      ].filter(({ hidden }) => !hidden),
    [
      commonSearchFilter,
      isFilterEmpty,
      isPublishingEnabled,
      isSharingEnabled,
      t,
    ],
  );

  return (
    <div
      className="flex w-full flex-col gap-0.5 divide-y divide-tertiary empty:hidden"
      data-qa="prompt-folders"
    >
      {!toApproveFolderItem.hidden && (
        <ApproveRequiredSection {...toApproveFolderItem} />
      )}
      {folderItems.map((itemProps) => (
        <PromptSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
