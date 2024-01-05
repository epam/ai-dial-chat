import { DragEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import {
  PublishedWithMeFilter,
  SharedWithMeFilter,
} from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
import { FolderInterface, FolderSectionProps } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { EntityFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Folder from '@/src/components/Folder/Folder';

import CollapsableSection from '../../Common/CollapsableSection';
import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { PromptComponent } from './Prompt';

interface promptFolderProps {
  folder: FolderInterface;
  index: number;
  isLast: boolean;
  filters: EntityFilters;
  includeEmpty: boolean;
}

const PromptFolderTemplate = ({
  folder,
  index,
  isLast,
  filters,
  includeEmpty = false,
}: promptFolderProps) => {
  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const prompts = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPrompts(state, filters, searchTerm),
  );
  const promptFolders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredFolders(
      state,
      filters,
      searchTerm,
      includeEmpty,
    ),
  );
  const openedFoldersIds = useAppSelector(UISelectors.selectOpenedFoldersIds);

  const handleDrop = useCallback(
    (e: DragEvent, folder: FolderInterface) => {
      if (e.dataTransfer) {
        const promptData = e.dataTransfer.getData('prompt');
        const folderData = e.dataTransfer.getData('folder');

        if (promptData) {
          const prompt: Prompt = JSON.parse(promptData);
          dispatch(
            PromptsActions.updatePrompt({
              promptId: prompt.id,
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
              PromptsActions.moveFolder({
                folderId: movedFolder.id,
                newParentFolderId: folder.id,
                newIndex: 0,
              }),
            );
          }
        }
      }
    },
    [dispatch],
  );

  const onDropBetweenFolders = useCallback(
    (
      folder: FolderInterface,
      parentFolderId: string | undefined,
      index: number,
    ) => {
      dispatch(
        PromptsActions.moveFolder({
          folderId: folder.id,
          newParentFolderId: parentFolderId,
          newIndex: index,
        }),
      );
    },
    [dispatch],
  );

  const handleFolderClick = useCallback(
    (folderId: string) => {
      dispatch(UIActions.toggleFolder({ id: folderId }));
    },
    [dispatch],
  );

  return (
    <>
      <BetweenFoldersLine
        level={0}
        onDrop={onDropBetweenFolders}
        index={index}
        parentFolderId={folder.folderId}
      />
      <Folder
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={PromptComponent}
        allItems={prompts}
        allFolders={promptFolders}
        highlightedFolders={highlightedFolders}
        openedFoldersIds={openedFoldersIds}
        handleDrop={handleDrop}
        onRenameFolder={(name, folderId) => {
          dispatch(
            PromptsActions.renameFolder({
              folderId,
              name,
            }),
          );
        }}
        onDeleteFolder={(folderId: string) =>
          dispatch(PromptsActions.deleteFolder({ folderId }))
        }
        onDropBetweenFolders={onDropBetweenFolders}
        onClickFolder={handleFolderClick}
        featureType={FeatureType.Prompt}
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          index={index + 1}
          parentFolderId={folder.folderId}
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
  const folders = useAppSelector((state) =>
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

  const rootfolders = useMemo(
    () => folders.filter(({ folderId }) => !folderId),
    [folders],
  );

  const rootPrompts = useMemo(
    () => prompts.filter(({ folderId }) => !folderId),
    [prompts],
  );

  const selectedFoldersIds = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );

  const selectSelectedPromptId = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  useEffect(() => {
    const shouldBeHighlighted =
      rootfolders.some((folder) => selectedFoldersIds.includes(folder.id)) ||
      (!!displayRootFiles &&
        rootPrompts.some(({ id }) => selectSelectedPromptId === id));
    if (isSectionHighlighted !== shouldBeHighlighted) {
      setIsSectionHighlighted(shouldBeHighlighted);
    }
  }, [
    displayRootFiles,
    rootfolders,
    isSectionHighlighted,
    selectSelectedPromptId,
    selectedFoldersIds,
    rootPrompts,
  ]);

  if (
    hideIfEmpty &&
    (!displayRootFiles || !prompts.length) &&
    !folders.length
  ) {
    return null;
  }

  return (
    <CollapsableSection
      name={t(name)}
      openByDefault={openByDefault}
      dataQa={dataQa}
      isHighlighted={isSectionHighlighted}
    >
      <div>
        {rootfolders.map((folder, index, arr) => (
          <PromptFolderTemplate
            key={folder.id}
            folder={folder}
            index={index}
            isLast={index === arr.length - 1}
            filters={filters}
            includeEmpty={showEmptyFolders}
          />
        ))}
      </div>
      <div>
        {displayRootFiles &&
          rootPrompts.map((item) => (
            <PromptComponent key={item.id} item={item} />
          ))}
      </div>
    </CollapsableSection>
  );
};

export function PromptFolders() {
  const { t } = useTranslation(Translation.PromptBar);
  const isFilterEmpty = useAppSelector(
    PromptsSelectors.selectIsEmptySearchFilter,
  );
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const commonSearchFilter = useAppSelector(
    PromptsSelectors.selectMyItemsFilters,
  );
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Prompt),
  );

  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.isPublishingEnabled(state, FeatureType.Prompt),
  );

  const folderItems: FolderSectionProps[] = useMemo(
    () =>
      [
        {
          hidden: !isPublishingEnabled || !isFilterEmpty,
          name: t('Organization'),
          filters: PublishedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'published-with-me',
          openByDefault: !!searchTerm.length,
        },
        {
          hidden: !isSharingEnabled || !isFilterEmpty,
          name: t('Shared with me'),
          filters: SharedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'shared-with-me',
          openByDefault: !!searchTerm.length,
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
      searchTerm.length,
      t,
    ],
  );

  return (
    <div
      className="flex w-full flex-col gap-0.5 divide-y divide-tertiary empty:hidden"
      data-qa="prompt-folders"
    >
      {folderItems.map((itemProps) => (
        <PromptSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
