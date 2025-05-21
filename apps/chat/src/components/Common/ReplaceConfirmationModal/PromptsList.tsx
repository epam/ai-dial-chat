import { isRootId } from '@/src/utils/app/id';

import { FeatureType, MappedReplaceActions } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { OnItemEvent } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';

import { Folder } from '@/src/components/Folder/Folder';

import { PromptsRow } from './Components';

interface Props {
  folders: FolderInterface[];
  mappedActions?: MappedReplaceActions;
  openedFoldersIds: string[];
  promptsToReplace: Prompt[];
  handleToggleFolder?: (folderId: string) => void;
  onItemEvent?: OnItemEvent;
}
export const PromptsList = ({
  folders,
  mappedActions,
  openedFoldersIds,
  promptsToReplace,
  handleToggleFolder,
  onItemEvent,
}: Props) => {
  return (
    <>
      {folders.map((folder) => {
        if (!isRootId(folder.folderId)) {
          return null;
        }

        return (
          <div key={folder.id}>
            <Folder<Prompt>
              readonly
              searchTerm={''}
              currentFolder={folder}
              allFolders={folders}
              highlightedFolders={[]}
              isInitialRenameEnabled
              displayCaretAlways
              additionalItemData={{ mappedActions }}
              openedFoldersIds={openedFoldersIds}
              allItems={promptsToReplace}
              itemComponent={PromptsRow}
              onClickFolder={handleToggleFolder}
              onItemEvent={onItemEvent}
              withBorderHighlight={false}
              featureType={FeatureType.Prompt}
              folderClassName="h-[38px]"
            />
          </div>
        );
      })}
      {promptsToReplace.map((prompt) => {
        if (!isRootId(prompt.folderId)) {
          return null;
        }

        return (
          <div key={prompt.id}>
            <PromptsRow
              item={prompt}
              onEvent={onItemEvent}
              additionalItemData={{ mappedActions }}
            />
          </div>
        );
      })}
    </>
  );
};
