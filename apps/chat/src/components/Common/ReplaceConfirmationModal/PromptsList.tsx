import { isRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { MappedReplaceActions } from '@/src/types/import-export';
import { Prompt } from '@/src/types/prompt';

import Folder from '../../Folder/Folder';
import { PromptsRow } from './Components';
import { OnItemEvent } from './ReplaceConfirmationModal';

interface Props {
  folders: FolderInterface[];
  mappedActions: MappedReplaceActions;
  openedFoldersIds: string[];
  promptsToReplace: Prompt[];
  handleToggleFolder: (folderId: string) => void;
  onItemEvent: OnItemEvent;
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
