import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { SharedWithMeFilter } from '@/src/utils/app/search';

import { EntityFilter, HighlightColor } from '@/src/types/common';
import { Feature } from '@/src/types/features';
import { FolderInterface, FolderSectionProps } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Folder from '@/src/components/Folder';

import CollapsableSection from '../../Common/CollapsableSection';
import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { PromptComponent } from './Prompt';

interface promptFolderProps {
  folder: FolderInterface;
  index: number;
  isLast: boolean;
  itemFilter: EntityFilter<Prompt>;
}

const PromptFolderTemplate = ({
  folder,
  index,
  isLast,
  itemFilter,
}: promptFolderProps) => {
  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const prompts = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPrompts(state, itemFilter, searchTerm),
  );
  const conversationFolders = useAppSelector(PromptsSelectors.selectFolders);
  const openedFoldersIds = useAppSelector(UISelectors.selectOpenedFoldersIds);

  const handleDrop = useCallback(
    (e: any, folder: FolderInterface) => {
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
        highlightColor={HighlightColor.Violet}
      />
      <Folder
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={PromptComponent}
        allItems={prompts}
        allFolders={conversationFolders}
        highlightColor={HighlightColor.Violet}
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
      />
      {isLast && (
        <BetweenFoldersLine
          level={0}
          onDrop={onDropBetweenFolders}
          index={index + 1}
          parentFolderId={folder.folderId}
          highlightColor={HighlightColor.Violet}
        />
      )}
    </>
  );
};

export const PromptSection = ({
  name,
  itemFilter,
  hideIfEmpty = true,
  displayRootFiles,
  showEmptyFolders = false,
  openByDefault = false,
  dataQa,
}: FolderSectionProps<Prompt>) => {
  const { t } = useTranslation(Translation.PromptBar);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);
  const folders = useAppSelector((state) =>
    PromptsSelectors.selectFilteredFolders(
      state,
      itemFilter,
      searchTerm,
      showEmptyFolders,
    ),
  );
  const prompts = useAppSelector((state) =>
    PromptsSelectors.selectFilteredPrompts(state, itemFilter, searchTerm),
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

  if (hideIfEmpty && !prompts.length && !folders.length) return null;

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
            itemFilter={itemFilter}
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
  const isFilterEmpty = useAppSelector(
    PromptsSelectors.selectIsEmptySearchFilter,
  );
  const commonItemFilter = useAppSelector(PromptsSelectors.selectItemFilter);
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.PromptsSharing),
  );

  const folderItems: FolderSectionProps<Prompt>[] = useMemo(
    () =>
      [
        {
          hide: !isSharingEnabled || !isFilterEmpty,
          name: 'Shared with me',
          itemFilter: SharedWithMeFilter,
          displayRootFiles: true,
          dataQa: 'share-with-me',
        },
        {
          name: 'Pinned prompts',
          itemFilter: commonItemFilter,
          showEmptyFolders: isFilterEmpty,
          openByDefault: true,
          dataQa: 'pinned-prompts',
        },
      ].filter(({ hide }) => !hide),
    [commonItemFilter, isFilterEmpty],
  );

  return (
    <div
      className="flex w-full flex-col gap-0.5 divide-y divide-gray-200 dark:divide-gray-800"
      data-qa="prompt-folders"
    >
      {folderItems.map((itemProps) => (
        <PromptSection key={itemProps.name} {...itemProps} />
      ))}
    </div>
  );
}
