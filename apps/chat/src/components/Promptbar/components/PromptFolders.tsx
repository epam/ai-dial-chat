import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { sortByName } from '@/src/utils/app/folders';
import { getPromptRootId, isEntityExternal } from '@/src/utils/app/id';
import { MoveType } from '@/src/utils/app/move';
import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
} from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
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
  allowHighlight?: boolean;
}

const publicationFeatureTypes = [FeatureType.Prompt, FeatureType.Application];

const PromptFolderTemplate = ({
  folder,
  isLast,
  filters,
  includeEmpty = false,
  allowHighlight = true,
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
  const isSelectMode = useAppSelector(PromptsSelectors.selectIsSelectMode);
  const selectedPrompts = useAppSelector(PromptsSelectors.selectSelectedItems);
  const { fullyChosenFolderIds, partialChosenFolderIds } = useAppSelector(
    (state) => PromptsSelectors.selectChosenFolderIds(state, prompts),
  );
  const emptyFoldersIds = useAppSelector(PromptsSelectors.selectEmptyFolderIds);
  const isFolderEmpty = useAppSelector((state) =>
    PromptsSelectors.selectIsFolderEmpty(state, folder.id),
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

  const handleFolderSelect = useCallback(
    (folderId: string) => {
      if (isFolderEmpty) {
        dispatch(PromptsActions.addToChosenEmptyFolders({ ids: [folderId] }));
      } else {
        dispatch(
          PromptsActions.setChosenPrompts({
            ids: prompts
              .filter(
                (p) =>
                  p.id.startsWith(folderId) &&
                  (!partialChosenFolderIds.includes(folderId) ||
                    !selectedPrompts.includes(p.id)),
              )
              .map((e) => e.id),
          }),
        );

        dispatch(
          PromptsActions.addToChosenEmptyFolders({
            ids: emptyFoldersIds
              .filter((id) => `${id}/`.startsWith(folderId))
              .map((id) => `${id}/`),
          }),
        );
      }
    },
    [
      dispatch,
      emptyFoldersIds,
      isFolderEmpty,
      partialChosenFolderIds,
      prompts,
      selectedPrompts,
    ],
  );

  const isExternal = isEntityExternal(folder);

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        featureType={FeatureType.Prompt}
        denyDrop={isExternal || isSelectMode}
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
        highlightedFolders={allowHighlight ? highlightedFolders : []}
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
                resourceIds: [folder.id],
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
        canSelectFolders={isSelectMode}
        additionalItemData={additionalFolderData}
        onSelectFolder={handleFolderSelect}
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          featureType={FeatureType.Prompt}
          denyDrop={isExternal || isSelectMode}
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
  openByDefault,
  dataQa,
}: FolderSectionProps) => {
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);

  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
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
  const selectedFoldersIds = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const { selectedPromptId, isSelectedPromptApproveRequiredResource } =
    useAppSelector(PromptsSelectors.selectSelectedPromptId);

  const { handleToggle, isExpanded } = useSectionToggle(
    name,
    FeatureType.Prompt,
  );

  const additionalPromptData = useMemo(
    () => ({
      isSidePanelItem: true,
    }),
    [],
  );

  const rootPrompts = useMemo(() => sortByName(prompts), [prompts]);

  const folderTemplateFilters = useMemo(
    () => ({
      searchFilter: filters.searchFilter,
      versionFilter: filters.versionFilter,
    }),
    [filters.searchFilter, filters.versionFilter],
  );

  useEffect(() => {
    const shouldBeHighlighted =
      !isSelectedPromptApproveRequiredResource &&
      (rootFolders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
        (!!displayRootFiles &&
          rootPrompts.some(({ id }) => selectedPromptId === id)));
    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    rootFolders,
    isSectionHighlighted,
    selectedPromptId,
    selectedFoldersIds,
    rootPrompts,
    isSelectedPromptApproveRequiredResource,
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
      onToggle={handleToggle}
      name={name}
      openByDefault={openByDefault ?? isExpanded}
      dataQa={dataQa}
      isHighlighted={isSectionHighlighted}
    >
      <div>
        {rootFolders.map((folder, index, arr) => (
          <PromptFolderTemplate
            key={folder.id}
            folder={folder}
            isLast={index === arr.length - 1}
            filters={folderTemplateFilters}
            includeEmpty={showEmptyFolders}
            allowHighlight={!isSelectedPromptApproveRequiredResource}
          />
        ))}
      </div>
      {displayRootFiles && (
        <div className="flex flex-col gap-1">
          {prompts.map((item) => (
            <PromptComponent
              additionalItemData={additionalPromptData}
              key={item.id}
              item={item}
            />
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
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Prompt),
  );
  const publicationItems = useAppSelector((state) =>
    PublicationSelectors.selectFilteredPublications(
      state,
      publicationFeatureTypes,
      true,
    ),
  );

  const toApproveFolderItem = {
    hidden: !publicationItems.length,
    name: PUBLISHING_APPROVE_REQUIRED_NAME,
    displayRootFiles: true,
    dataQa: 'approve-required',
  };

  const folderItems: FolderSectionProps[] = useMemo(
    () =>
      [
        {
          hidden: !isPublishingEnabled || !isFilterEmpty,
          name: PUBLISHING_FOLDER_NAME,
          filters: PublishedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'published-with-me',
        },
        {
          hidden: !isSharingEnabled || !isFilterEmpty,
          name: t('Shared with me'),
          filters: SharedWithMeFilters,
          ignoreRootFilter: true,
          displayRootFiles: true,
          dataQa: 'shared-with-me',
        },
        {
          name: t('Pinned prompts'),
          filters: commonSearchFilter,
          showEmptyFolders: isFilterEmpty,
          dataQa: 'pinned-prompts',
        },
      ].filter(({ hidden }) => !hidden),
    [
      t,
      commonSearchFilter,
      isFilterEmpty,
      isPublishingEnabled,
      isSharingEnabled,
    ],
  );

  return (
    <div
      className="flex w-full flex-col gap-0.5 divide-y divide-tertiary empty:hidden"
      data-qa="prompt-folders"
    >
      {!toApproveFolderItem.hidden && (
        <ApproveRequiredSection
          featureTypes={publicationFeatureTypes}
          publicationItems={publicationItems}
          includeEmptyResourceTypesEmpty
          {...toApproveFolderItem}
        />
      )}
      {folderItems.map((itemProps) => (
        <PromptSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
