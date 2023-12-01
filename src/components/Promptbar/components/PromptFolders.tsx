import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { PinnedItemsFilter, SharedWithMeFilter } from '@/src/utils/app/search';

import { HighlightColor } from '@/src/types/common';
import { FolderInterface, FolderSectionProps } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Folder from '@/src/components/Folder';

import CaretIconComponent from '../../Folder/CaretIconComponent';
import { BetweenFoldersLine } from '../../Sidebar/BetweenFoldersLine';
import { PromptComponent } from './Prompt';

interface promptFolderProps {
  folder: FolderInterface;
  index: number;
  isLast: boolean;
}

const PromptFolderTemplate = ({ folder, index, isLast }: promptFolderProps) => {
  const dispatch = useAppDispatch();

  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
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
  hideIfEmpty,
  displayRootFiles,
  showEmptyFolders = false,
  openByDefault = false,
  dataQa,
}: FolderSectionProps<Prompt>) => {
  const { t } = useTranslation('chat');
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const [isSectionOpened, setIsSectionOpened] = useState(openByDefault);
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

  function handleSectionOpen() {
    setIsSectionOpened((isOpen) => !isOpen);
  }

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
    <div className="flex w-full flex-col py-1 pl-2 pr-0.5" data-qa={dataQa}>
      <button
        className={classNames(
          'flex items-center gap-1 py-1 text-xs',
          isSectionHighlighted ? 'text-green' : '[&:not(:hover)]:text-gray-500',
        )}
        data-qa="chronology"
        onClick={handleSectionOpen}
      >
        <CaretIconComponent isOpen={isSectionOpened} />
        {t(name)}
      </button>
      {isSectionOpened && (
        <>
          <div>
            {rootfolders.map((folder, index, arr) => (
              <PromptFolderTemplate
                key={folder.id}
                folder={folder}
                index={index}
                isLast={index === arr.length - 1}
              />
            ))}
          </div>
          <div>
            {displayRootFiles &&
              rootPrompts.map((item) => (
                <PromptComponent key={item.id} item={item} />
              ))}
          </div>
        </>
      )}
    </div>
  );
};

const folderItems: FolderSectionProps<Prompt>[] = [
  {
    name: 'Share With Me',
    itemFilter: SharedWithMeFilter,
    hideIfEmpty: true,
    displayRootFiles: true,
    dataQa: 'share-with-me',
  },
  {
    name: 'Pinned prompts',
    itemFilter: PinnedItemsFilter,
    showEmptyFolders: true,
    openByDefault: true,
    dataQa: 'pinned-prompts',
  },
];

export function PromptFolders() {
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
