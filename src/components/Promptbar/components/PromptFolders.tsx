import { useCallback } from 'react';

import classNames from 'classnames';

import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Folder from '@/src/components/Folder';

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
        highlightColor="violet"
      />
      <Folder
        searchTerm={searchTerm}
        currentFolder={folder}
        itemComponent={PromptComponent}
        allItems={prompts}
        allFolders={conversationFolders}
        highlightColor="violet"
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
          highlightColor="violet"
        />
      )}
    </>
  );
};

export const PromptFolders = () => {
  const folders = useAppSelector(PromptsSelectors.selectFolders);

  return (
    <div
      className={classNames('flex w-full flex-col')}
      data-qa="prompt-folders"
    >
      {folders.map((folder, index, arr) => {
        if (!folder.folderId) {
          return (
            <PromptFolderTemplate
              key={index}
              folder={folder}
              index={index}
              isLast={index === arr.length - 1}
            />
          );
        }

        return null;
      })}
    </div>
  );
};
