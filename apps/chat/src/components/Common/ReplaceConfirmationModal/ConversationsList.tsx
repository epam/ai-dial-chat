import { isRootId } from '@/src/utils/app/id';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { MappedReplaceActions } from '@/src/types/import-export';

import Folder from '../../Folder/Folder';
import { ConversationRow } from './Components';
import { OnItemEvent } from './ReplaceConfirmationModal';

interface Props {
  folders: FolderInterface[];
  mappedActions: MappedReplaceActions;
  openedFoldersIds: string[];
  conversationsToReplace: Conversation[];
  handleToggleFolder: (folderId: string) => void;
  onItemEvent: OnItemEvent;
}
export const ConversationsList = ({
  folders,
  mappedActions,
  openedFoldersIds,
  conversationsToReplace,
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
            <Folder<Conversation>
              readonly
              searchTerm={''}
              currentFolder={folder}
              allFolders={folders}
              highlightedFolders={[]}
              isInitialRenameEnabled
              displayCaretAlways
              additionalItemData={{ mappedActions }}
              openedFoldersIds={openedFoldersIds}
              allItems={conversationsToReplace}
              itemComponent={ConversationRow}
              onClickFolder={handleToggleFolder}
              onItemEvent={onItemEvent}
              withBorderHighlight={false}
              featureType={FeatureType.Chat}
            />
          </div>
        );
      })}
      {conversationsToReplace.map((conversation, index) => {
        if (!isRootId(conversation.folderId)) {
          return null;
        }

        return (
          <div key={index + conversation.id}>
            <ConversationRow
              item={conversation}
              onEvent={onItemEvent}
              additionalItemData={{ mappedActions }}
            />
          </div>
        );
      })}
    </>
  );
};
