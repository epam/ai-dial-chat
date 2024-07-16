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
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
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
  rootFolder?: ShareEntity;
  showTooltip?: boolean;
  isOpen?: boolean;
  additionalItemData?: Record<string, unknown>;
  onSelect?: (ids: string[]) => void;
  resourcesClassNames?: string;
}

const filterItems = ({
  isUnselectAllAction,
  folderId,
  items,
  chosenItemsIds,
}: {
  isUnselectAllAction: boolean;
  folderId: string;
  items: ShareEntity[];
  chosenItemsIds: string[];
}) => {
  const folderIdParts = folderId.split('/');

  return items
    .filter(
      (c) =>
        c.id.startsWith(folderId) &&
        c.id.split('/').length >= folderIdParts.length &&
        (isUnselectAllAction
          ? chosenItemsIds.includes(c.id)
          : !chosenItemsIds.includes(c.id)),
    )
    .map((c) => c.id);
};

export const PromptPublicationResources = ({
  resources,
  readonly,
  rootFolder,
  showTooltip,
  isOpen = true,
  additionalItemData,
  onSelect,
  resourcesClassNames,
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
  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, prompts, rootFolder);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!readonly}
            level={readonly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={allFolders.filter((f) =>
              folderItemsToDisplay.some((item) =>
                item.id.startsWith(`${f.id}/`),
              ),
            )}
            searchTerm={readonly ? '' : searchTerm}
            openedFoldersIds={
              readonly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderItemsToDisplay}
            itemComponent={(props) =>
              readonly ? (
                <PromptsRow
                  {...props}
                  onSelect={onSelect}
                  isChosen={chosenItemsIds.some((id) => id === props.item.id)}
                />
              ) : (
                <PromptComponent {...props} />
              )
            }
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
              resourcesClassNames,
            )}
            additionalItemData={additionalItemData}
            showTooltip={showTooltip}
            canSelectFolders
            onSelectFolder={(folderId) => {
              if (!onSelect) return;

              onSelect(
                filterItems({
                  isUnselectAllAction: (
                    additionalItemData?.partialSelectedFolderIds as string
                  ).includes(folderId),
                  items: prompts,
                  folderId,
                  chosenItemsIds,
                }),
              );
            }}
            isSidePanelFolder={false}
          />
        );
      })}
      {itemsToDisplay.map((p) =>
        readonly ? (
          <PromptsRow
            itemComponentClassNames={classNames(
              'group/prompt-item cursor-pointer',
              resourcesClassNames,
            )}
            key={p.id}
            item={p}
            level={0}
            onSelect={onSelect}
            isChosen={chosenItemsIds.some((id) => id === p.id)}
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
  rootFolder,
  showTooltip,
  isOpen = true,
  additionalItemData,
  onSelect,
  resourcesClassNames,
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
  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, conversations, rootFolder);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!readonly}
            level={readonly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={allFolders.filter((f) =>
              folderItemsToDisplay.some((item) =>
                item.id.startsWith(`${f.id}/`),
              ),
            )}
            searchTerm={readonly ? '' : searchTerm}
            openedFoldersIds={
              readonly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            onSelectFolder={(folderId) => {
              if (!onSelect) return;

              onSelect(
                filterItems({
                  isUnselectAllAction: (
                    additionalItemData?.partialSelectedFolderIds as string
                  ).includes(folderId),
                  items: conversations,
                  folderId,
                  chosenItemsIds,
                }),
              );
            }}
            allItems={folderItemsToDisplay}
            itemComponent={(props) =>
              readonly ? (
                <ConversationRow
                  {...props}
                  onSelect={onSelect}
                  isChosen={chosenItemsIds.some((id) => id === props.item.id)}
                />
              ) : (
                <ConversationComponent {...props} />
              )
            }
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
              resourcesClassNames,
            )}
            additionalItemData={additionalItemData}
            showTooltip={showTooltip}
            canSelectFolders
            isSidePanelFolder={false}
          />
        );
      })}
      {itemsToDisplay.map((c) =>
        readonly ? (
          <ConversationRow
            itemComponentClassNames={classNames(
              'group/conversation-item cursor-pointer',
              resourcesClassNames,
            )}
            key={c.id}
            item={c}
            level={0}
            onSelect={onSelect}
            isChosen={chosenItemsIds.some((id) => id === c.id)}
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
  // TODO: get rid of uploaded files in https://github.com/epam/ai-dial-chat/issues/1502
  uploadedFiles,
  isOpen = true,
  showTooltip,
  onSelect,
  additionalItemData,
  resourcesClassNames,
}: PublicationResources & { uploadedFiles?: DialFile[] }) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.File),
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);
  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  const { rootFolders, itemsToDisplay, folderItemsToDisplay } =
    usePublicationResources(allFolders, resources, files);

  return (
    <div className={classNames(!isOpen && 'hidden')}>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!readonly}
            displayCaretAlways
            level={readonly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={allFolders.filter((f) =>
              folderItemsToDisplay.some((item) =>
                item.id.startsWith(`${f.id}/`),
              ),
            )}
            searchTerm={''}
            openedFoldersIds={
              readonly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderItemsToDisplay}
            itemComponent={(props) =>
              readonly ? (
                <FilesRow
                  {...props}
                  onSelect={onSelect}
                  isChosen={chosenItemsIds.some((id) => id === props.item.id)}
                />
              ) : (
                <FileItem {...props} />
              )
            }
            onClickFolder={(folderId: string) => {
              if (readonly) return;
              dispatch(FilesActions.getFolders({ id: folderId }));
            }}
            featureType={FeatureType.File}
            folderClassName={classNames(readonly && 'h-[38px]')}
            itemComponentClassNames={classNames(
              readonly && 'group/file-item cursor-pointer',
              resourcesClassNames,
            )}
            showTooltip={showTooltip}
            canSelectFolders
            onSelectFolder={(folderId) => {
              if (!onSelect) return;

              onSelect(
                filterItems({
                  isUnselectAllAction: (
                    additionalItemData?.partialSelectedFolderIds as string
                  ).includes(folderId),
                  items: files,
                  folderId,
                  chosenItemsIds,
                }),
              );
            }}
            isSidePanelFolder={false}
          />
        );
      })}
      {(uploadedFiles ?? itemsToDisplay).map((f) =>
        readonly ? (
          <FilesRow
            itemComponentClassNames={classNames(
              'group/file-item cursor-pointer',
              resourcesClassNames,
            )}
            key={f.id}
            item={f}
            level={0}
            onSelect={onSelect}
            isChosen={chosenItemsIds.some((id) => id === f.id)}
          />
        ) : (
          <FileItem key={f.id} item={f} level={1} />
        ),
      )}
    </div>
  );
};
