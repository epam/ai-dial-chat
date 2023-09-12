import { useCallback } from 'react';

import { FolderInterface } from '@/src/types/folder';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import Folder from '@/src/components/Folder';
import { PromptComponent } from '@/src/components/Promptbar/components/Prompt';

export const PromptFolders = () => {
  const dispatch = useAppDispatch();
  const filteredPrompts = useAppSelector(
    PromptsSelectors.selectSearchedPrompts,
  );
  const folders = useAppSelector(PromptsSelectors.selectFolders);
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);

  const handleDrop = useCallback(
    (e: any, folder: FolderInterface) => {
      if (e.dataTransfer) {
        const prompt = JSON.parse(e.dataTransfer.getData('prompt'));
        dispatch(
          PromptsActions.updatePrompt({
            promptId: prompt.id,
            values: { folderId: folder.id },
          }),
        );
      }
    },
    [dispatch],
  );

  const PromptFolders = useCallback(
    (currentFolder: FolderInterface) =>
      filteredPrompts
        .filter((p) => p.folderId)
        .map((prompt, index) => {
          if (prompt.folderId === currentFolder.id) {
            return (
              <div
                key={index}
                className="ml-5 gap-2 border-l border-gray-500 pl-2"
              >
                <PromptComponent prompt={prompt} />
              </div>
            );
          }
        }),
    [filteredPrompts],
  );

  return (
    <div className="flex w-full flex-col" data-qa="prompt-folders">
      {folders.map((folder, index) => (
        <Folder
          key={index}
          searchTerm={searchTerm}
          currentFolder={folder}
          highlightColor="violet"
          folderComponent={PromptFolders(folder)}
          handleDrop={handleDrop}
          onRenameFolder={(newName) => {
            dispatch(
              PromptsActions.renameFolder({
                folderId: folder.id,
                name: newName,
              }),
            );
          }}
          onDeleteFolder={() =>
            dispatch(PromptsActions.deleteFolder({ folderId: folder.id }))
          }
        />
      ))}
    </div>
  );
};
