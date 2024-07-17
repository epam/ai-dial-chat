import classNames from 'classnames';

import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import { FeatureType, UploadStatus } from '@/src/types/common';
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
  readonly?: boolean;
  showTooltip?: boolean;
  isOpen?: boolean;
  additionalItemData?: Record<string, unknown>;
}

export const PromptPublicationResources = ({
  resources,
  readonly,
  showTooltip,
  isOpen = true,
  additionalItemData,
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
  const { isSelectedPromptApproveRequiredResource } = useAppSelector(
    PromptsSelectors.selectSelectedPromptId,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, prompts);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.map((f) => (
        <Folder
          readonly
          key={f.id}
          noCaretIcon={!!readonly}
          level={readonly ? 0 : 1}
          currentFolder={f}
          allFolders={allFolders.filter((f) =>
            folderItemsToDisplay.some((item) => item.id.startsWith(`${f.id}/`)),
          )}
          searchTerm={readonly ? '' : searchTerm}
          openedFoldersIds={
            readonly ? allFolders.map((f) => f.id) : openedFoldersIds
          }
          allItems={folderItemsToDisplay}
          itemComponent={readonly ? PromptsRow : PromptComponent}
          onClickFolder={(folderId: string) => {
            if (readonly) return;
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
            !isSelectedPromptApproveRequiredResource || readonly
              ? undefined
              : highlightedFolders
          }
          folderClassName={classNames(readonly && 'h-[38px]')}
          itemComponentClassNames={classNames(
            readonly && 'group/prompt-item cursor-pointer',
          )}
          showTooltip={showTooltip}
          isSidePanelFolder={false}
          additionalItemData={additionalItemData}
        />
      ))}
      {itemsToDisplay.map((p) =>
        readonly ? (
          <PromptsRow
            itemComponentClassNames="group/prompt-item cursor-pointer"
            key={p.id}
            item={p}
            level={0}
          />
        ) : (
          <PromptComponent
            key={p.id}
            item={p}
            level={1}
            additionalItemData={additionalItemData}
          />
        ),
      )}
    </div>
  );
};

export const ConversationPublicationResources = ({
  resources,
  readonly,
  showTooltip,
  isOpen = true,
  additionalItemData,
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
    usePublicationResources(allFolders, resources, conversations);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.map((f) => (
        <Folder
          readonly
          key={f.id}
          noCaretIcon={!!readonly}
          level={readonly ? 0 : 1}
          currentFolder={f}
          allFolders={allFolders.filter((f) =>
            folderItemsToDisplay.some((item) => item.id.startsWith(`${f.id}/`)),
          )}
          searchTerm={readonly ? '' : searchTerm}
          openedFoldersIds={
            readonly ? allFolders.map((f) => f.id) : openedFoldersIds
          }
          allItems={folderItemsToDisplay}
          itemComponent={readonly ? ConversationRow : ConversationComponent}
          onClickFolder={(folderId: string) => {
            if (readonly) return;
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
          highlightedFolders={readonly ? undefined : highlightedFolders}
          folderClassName={classNames(readonly && 'h-[38px]')}
          itemComponentClassNames={classNames(
            readonly && 'group/conversation-item cursor-pointer',
          )}
          additionalItemData={additionalItemData}
          showTooltip={showTooltip}
          isSidePanelFolder={false}
        />
      ))}
      {itemsToDisplay.map((c) =>
        readonly ? (
          <ConversationRow
            itemComponentClassNames="group/conversation-item cursor-pointer"
            key={c.id}
            item={c}
            level={0}
          />
        ) : (
          <ConversationComponent
            additionalItemData={additionalItemData}
            key={c.id}
            item={c}
            level={1}
          />
        ),
      )}
    </div>
  );
};

export const FilePublicationResources = ({
  resources,
  readonly,
  isOpen = true,
  showTooltip,
}: PublicationResources) => {
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
      {rootFolders.map((f) => (
        <Folder
          key={f.id}
          readonly
          noCaretIcon={!!readonly}
          displayCaretAlways
          level={readonly ? 0 : 1}
          currentFolder={f}
          allFolders={allFolders.filter((f) =>
            folderItemsToDisplay.some((item) => item.id.startsWith(`${f.id}/`)),
          )}
          searchTerm={''}
          openedFoldersIds={
            readonly ? allFolders.map((f) => f.id) : openedFoldersIds
          }
          allItems={folderItemsToDisplay}
          itemComponent={readonly ? FilesRow : FileItem}
          onClickFolder={(folderId: string) => {
            if (readonly) return;
            dispatch(FilesActions.getFolders({ id: folderId }));
          }}
          featureType={FeatureType.File}
          folderClassName={classNames(readonly && 'h-[38px]')}
          itemComponentClassNames={classNames(
            readonly && 'group/file-item cursor-pointer',
          )}
          showTooltip={showTooltip}
        />
      ))}
      {itemsToDisplay.map((f) =>
        readonly ? (
          <FilesRow
            itemComponentClassNames="group/file-item cursor-pointer"
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
