import { useMemo } from 'react';

import classNames from 'classnames';

import { isRootId } from '@/src/utils/app/id';

import { FeatureType, ShareEntity } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
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

import uniqBy from 'lodash-es/uniqBy';

interface PublicationResources {
  resources: PublicationResource[];
  forViewOnly?: boolean;
  rootFolder?: ShareEntity;
}

export const PromptPublicationResources = ({
  resources,
  forViewOnly,
  rootFolder,
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

  const resourceUrls = useMemo(
    () => resources.map((r) => (r.reviewUrl ? r.reviewUrl : r.targetUrl)),
    [resources],
  );
  const promptsToDisplay = useMemo(() => {
    return prompts.filter(
      (c) => c.folderId.split('/').length === 2 && resourceUrls.includes(c.id),
    );
  }, [prompts, resourceUrls]);
  const folderPromptsToDisplay = useMemo(() => {
    return prompts.filter(
      (c) => c.folderId.split('/').length !== 2 && resourceUrls.includes(c.id),
    );
  }, [prompts, resourceUrls]);
  const rootFolders = useMemo(() => {
    if (rootFolder) return allFolders.filter((f) => f.id === rootFolder.id);

    const folders = resources.map((resource) => {
      const relevantFolders = allFolders.filter((folder) =>
        resource.reviewUrl
          ? resource.reviewUrl.startsWith(folder.id)
          : resource.targetUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [allFolders, resources, rootFolder]);

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
            allFolders={allFolders}
            searchTerm={forViewOnly ? '' : searchTerm}
            openedFoldersIds={
              forViewOnly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderPromptsToDisplay}
            itemComponent={forViewOnly ? PromptsRow : PromptComponent}
            onClickFolder={(folderId: string) => {
              if (forViewOnly) return;
              dispatch(PromptsActions.toggleFolder({ id: folderId }));
            }}
            featureType={FeatureType.Prompt}
            highlightedFolders={forViewOnly ? undefined : highlightedFolders}
            folderClassName={classNames(forViewOnly && 'h-[38px]')}
            itemComponentClassNames={classNames(
              forViewOnly && 'cursor-pointer',
            )}
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
  rootFolder,
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

  const resourceUrls = useMemo(
    () => resources.map((r) => (r.reviewUrl ? r.reviewUrl : r.targetUrl)),
    [resources],
  );
  const conversationsToDisplay = useMemo(() => {
    return conversations.filter(
      (c) => c.folderId.split('/').length === 2 && resourceUrls.includes(c.id),
    );
  }, [conversations, resourceUrls]);
  const folderConversationsToDisplay = useMemo(() => {
    return conversations.filter(
      (c) => c.folderId.split('/').length !== 2 && resourceUrls.includes(c.id),
    );
  }, [conversations, resourceUrls]);
  const rootFolders = useMemo(() => {
    if (rootFolder) return allFolders.filter((f) => f.id === rootFolder.id);

    const folders = resources.map((resource) => {
      const relevantFolders = allFolders.filter((folder) =>
        resource.reviewUrl
          ? resource.reviewUrl.startsWith(folder.id)
          : resource.targetUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [allFolders, resources, rootFolder]);

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
            allFolders={allFolders}
            searchTerm={forViewOnly ? '' : searchTerm}
            openedFoldersIds={
              forViewOnly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderConversationsToDisplay}
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
  uploadedFiles,
}: PublicationResources & { uploadedFiles?: DialFile[] }) => {
  const dispatch = useAppDispatch();

  const openedFoldersIds = useAppSelector((state) =>
    UISelectors.selectOpenedFoldersIds(state, FeatureType.Chat),
  );
  const files = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);

  const resourceUrls = useMemo(
    () => resources.map((r) => (r.reviewUrl ? r.reviewUrl : r.targetUrl)),
    [resources],
  );
  const filesToDisplay = useMemo(() => {
    return uploadedFiles
      ? uploadedFiles
      : files.filter(
          (f) =>
            f.folderId.split('/').length === 2 && resourceUrls.includes(f.id),
        );
  }, [files, uploadedFiles, resourceUrls]);
  const folderFilesToDisplay = useMemo(() => {
    return files.filter(
      (c) => c.folderId.split('/').length !== 2 && resourceUrls.includes(c.id),
    );
  }, [files, resourceUrls]);
  const rootFolders = useMemo(() => {
    const folders = resources.map((resource) => {
      const relevantFolders = allFolders.filter((folder) =>
        resource.reviewUrl
          ? resource.reviewUrl.startsWith(folder.id)
          : resource.targetUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [allFolders, resources]);

  return (
    <>
      {rootFolders.filter(Boolean).map((f) => {
        return (
          <Folder
            readonly
            noCaretIcon={!!forViewOnly}
            displayCaretAlways
            level={forViewOnly ? 0 : 1}
            key={f.id}
            currentFolder={f}
            allFolders={allFolders}
            searchTerm={''}
            openedFoldersIds={
              forViewOnly ? allFolders.map((f) => f.id) : openedFoldersIds
            }
            allItems={folderFilesToDisplay}
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
