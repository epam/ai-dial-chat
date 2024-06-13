import classNames from 'classnames';

import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import { FeatureType, ShareEntity, UploadStatus } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { PublicationResource } from '@/src/types/publication';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { PromptComponent } from '../../Promptbar/components/Prompt';

import { ConversationComponent } from '../../Chatbar/Conversation';
import {
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '../../Common/ReplaceConfirmationModal/Components';
import { FileItem } from '../../Files/FileItem';
import Folder from '../../Folder/Folder';

interface PublicationResources {
  resources: PublicationResource[];
  forViewOnly?: boolean;
  rootFolder?: ShareEntity;
  showTooltip?: boolean;
  isOpen?: boolean;
}

export const PromptPublicationResources = ({
  resources,
  forViewOnly,
  rootFolder,
  showTooltip,
  isOpen = true,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Prompt),
  );
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);
  const { isSelectedPublicationResource } = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, prompts, rootFolder);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!forViewOnly}
            level={forViewOnly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={allFolders.filter((f) =>
              folderItemsToDisplay.some((item) =>
                item.id.startsWith(`${f.id}/`),
              ),
            )}
            searchTerm={forViewOnly ? '' : searchTerm}
            openedFoldersIds={
              forViewOnly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderItemsToDisplay}
            itemComponent={forViewOnly ? PromptsRow : PromptComponent}
            onClickFolder={(folderId: string) => {
              if (forViewOnly) return;
              dispatch(PromptsActions.toggleFolder({ id: folderId }));

              if (f.status !== UploadStatus.LOADED) {
                dispatch(
                  PromptsActions.uploadPromptsWithFoldersRecursive({
                    path: folderId,
                    noLoader: true,
                  }),
                );
              }
            }}
            featureType={FeatureType.Prompt}
            highlightedFolders={
              !isSelectedPublicationResource || forViewOnly
                ? undefined
                : highlightedFolders
            }
            folderClassName={classNames(forViewOnly && 'h-[38px]')}
            itemComponentClassNames={classNames(
              forViewOnly && 'cursor-pointer',
            )}
            showTooltip={showTooltip}
            additionalItemData={{ isPublicationResource: true }}
          />
        );
      })}
      {itemsToDisplay.map((p) =>
        forViewOnly ? (
          <PromptsRow
            itemComponentClassNames="cursor-pointer"
            key={p.id}
            item={p}
            level={0}
          />
        ) : (
          <PromptComponent
            key={p.id}
            item={p}
            level={1}
            additionalItemData={{ isPublicationResource: true }}
          />
        ),
      )}
    </div>
  );
};

export const ConversationPublicationResources = ({
  resources,
  forViewOnly,
  rootFolder,
  showTooltip,
  isOpen = true,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, conversations, rootFolder);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!forViewOnly}
            level={forViewOnly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={allFolders.filter((f) =>
              folderItemsToDisplay.some((item) =>
                item.id.startsWith(`${f.id}/`),
              ),
            )}
            searchTerm={forViewOnly ? '' : searchTerm}
            openedFoldersIds={
              forViewOnly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderItemsToDisplay}
            itemComponent={
              forViewOnly ? ConversationRow : ConversationComponent
            }
            onClickFolder={(folderId: string) => {
              if (forViewOnly) return;
              dispatch(ConversationsActions.toggleFolder({ id: folderId }));

              if (f.status !== UploadStatus.LOADED) {
                dispatch(
                  ConversationsActions.uploadConversationsWithFoldersRecursive({
                    path: folderId,
                    noLoader: true,
                  }),
                );
              }
            }}
            featureType={FeatureType.Chat}
            highlightedFolders={forViewOnly ? undefined : highlightedFolders}
            folderClassName={classNames(forViewOnly && 'h-[38px]')}
            itemComponentClassNames={classNames(
              forViewOnly && 'cursor-pointer',
            )}
            showTooltip={showTooltip}
          />
        );
      })}
      {itemsToDisplay.map((c) =>
        forViewOnly ? (
          <ConversationRow
            itemComponentClassNames="cursor-pointer"
            key={c.id}
            item={c}
            level={0}
          />
        ) : (
          <ConversationComponent key={c.id} item={c} level={1} />
        ),
      )}
    </div>
  );
};

export const FilePublicationResources = ({
  resources,
  forViewOnly,
  // TODO: get rid of uploaded files in https://github.com/epam/ai-dial-chat/issues/1502
  uploadedFiles,
  isOpen = true,
}: PublicationResources & { uploadedFiles?: DialFile[] }) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.File),
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, files);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!forViewOnly}
            displayCaretAlways
            level={forViewOnly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={allFolders.filter((f) =>
              folderItemsToDisplay.some((item) =>
                item.id.startsWith(`${f.id}/`),
              ),
            )}
            searchTerm={''}
            openedFoldersIds={
              forViewOnly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderItemsToDisplay}
            itemComponent={forViewOnly ? FilesRow : FileItem}
            onClickFolder={(folderId: string) => {
              if (forViewOnly) return;
              dispatch(FilesActions.getFolders({ id: folderId }));
            }}
            featureType={FeatureType.File}
            folderClassName={classNames(forViewOnly && 'h-[38px]')}
            itemComponentClassNames={classNames(
              forViewOnly && 'cursor-pointer',
            )}
          />
        );
      })}
      {(uploadedFiles ?? itemsToDisplay).map((f) =>
        forViewOnly ? (
          <FilesRow
            itemComponentClassNames="cursor-pointer"
            key={f.id}
            item={f}
            level={0}
          />
        ) : (
          <FileItem key={f.id} item={f} level={1} />
        ),
      )}
    </div>
  );
};
