import classNames from 'classnames';

import {
  useConversationsPublicationResources,
  useFilesPublicationResources,
  usePromptPublicationResources,
} from '@/src/hooks/usePublicationResources';

import { FeatureType } from '@/src/types/common';
import { PublicationResource } from '@/src/types/publication';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { FilesActions } from '@/src/store/files/files.reducers';
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
}

export const PromptPublicationResources = ({
  resources,
  forViewOnly,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Prompt),
  );
  const searchTerm = useAppSelector(PromptsSelectors.selectSearchTerm);
  const {
    rootFolders,
    publicationFolders,
    promptsToDisplay,
    highlightedFolders,
    prompts,
  } = usePromptPublicationResources(resources);

  return (
    <>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!forViewOnly}
            level={forViewOnly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={publicationFolders}
            searchTerm={forViewOnly ? '' : searchTerm}
            openedFoldersIds={
              forViewOnly
                ? publicationFolders.map((f) => f.id)
                : openedFoldersIds
            }
            allItems={prompts}
            itemComponent={forViewOnly ? PromptsRow : PromptComponent}
            onClickFolder={(folderId: string) => {
              if (forViewOnly) return;
              dispatch(PromptsActions.toggleFolder({ id: folderId }));
            }}
            featureType={FeatureType.Prompt}
            highlightedFolders={forViewOnly ? undefined : highlightedFolders}
          />
        );
      })}
      {promptsToDisplay.map((p) =>
        forViewOnly ? (
          <PromptsRow
            itemComponentClassNames="cursor-pointer"
            key={p.id}
            item={p}
            level={0}
          />
        ) : (
          <PromptComponent key={p.id} item={p} level={1} />
        ),
      )}
    </>
  );
};

export const ConversationPublicationResources = ({
  resources,
  forViewOnly,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const searchTerm = useAppSelector(ConversationsSelectors.selectSearchTerm);
  const {
    rootFolders,
    publicationFolders,
    conversationsToDisplay,
    highlightedFolders,
    conversations,
  } = useConversationsPublicationResources(resources);

  return (
    <>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!forViewOnly}
            level={forViewOnly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={publicationFolders}
            searchTerm={forViewOnly ? '' : searchTerm}
            openedFoldersIds={
              forViewOnly
                ? publicationFolders.map((f) => f.id)
                : openedFoldersIds
            }
            allItems={conversations}
            itemComponent={
              forViewOnly ? ConversationRow : ConversationComponent
            }
            onClickFolder={(folderId: string) => {
              if (forViewOnly) return;
              dispatch(ConversationsActions.toggleFolder({ id: folderId }));
            }}
            featureType={FeatureType.Chat}
            highlightedFolders={forViewOnly ? undefined : highlightedFolders}
            folderClassName={classNames(forViewOnly && 'h-[38px]')}
            itemComponentClassNames={classNames(
              forViewOnly && 'cursor-pointer',
            )}
          />
        );
      })}
      {conversationsToDisplay.map((c) =>
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
    </>
  );
};

export const FilePublicationResources = ({
  resources,
  forViewOnly,
}: PublicationResources) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const { rootFolders, publicationFolders, filesToDisplay, files } =
    useFilesPublicationResources(resources);

  return (
    <>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!forViewOnly}
            level={forViewOnly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={publicationFolders}
            searchTerm={''}
            openedFoldersIds={
              forViewOnly
                ? publicationFolders.map((f) => f.id)
                : openedFoldersIds
            }
            allItems={files}
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
      {filesToDisplay.map((f) =>
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
    </>
  );
};
