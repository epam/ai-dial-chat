import { useMemo } from 'react';

import { isRootId } from '../utils/app/id';

import { FolderInterface } from '../types/folder';
import { PublicationResource } from '../types/publication';

import { ConversationsSelectors } from '../store/conversations/conversations.reducers';
import { FilesSelectors } from '../store/files/files.reducers';
import { useAppSelector } from '../store/hooks';
import { PromptsSelectors } from '../store/prompts/prompts.reducers';

import uniqBy from 'lodash-es/uniqBy';

export const usePromptPublicationResources = (
  resources: PublicationResource[],
) => {
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const publicationFolders = useAppSelector(
    PromptsSelectors.selectPublicationFolders,
  );
  const highlightedFolders = useAppSelector(
    PromptsSelectors.selectSelectedPromptFoldersIds,
  );

  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );

  const promptsToDisplay = useMemo(() => {
    return prompts.filter(
      (c) => c.folderId.split('/').length === 2 && resourceUrls.includes(c.id),
    );
  }, [prompts, resourceUrls]);

  const rootFolders = useMemo(() => {
    const folders = resources.map((resource) => {
      const relevantFolders = publicationFolders.filter((folder) =>
        resource.reviewUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [publicationFolders, resources]);

  return {
    rootFolders,
    publicationFolders,
    promptsToDisplay,
    highlightedFolders,
    prompts,
  };
};

export const useConversationsPublicationResources = (
  resources: PublicationResource[],
) => {
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const publicationFolders = useAppSelector(
    ConversationsSelectors.selectPublicationFolders,
  );
  const highlightedFolders = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsFoldersIds,
  );

  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );

  const conversationsToDisplay = useMemo(() => {
    return conversations.filter(
      (c) => c.folderId.split('/').length === 2 && resourceUrls.includes(c.id),
    );
  }, [conversations, resourceUrls]);

  const rootFolders = useMemo(() => {
    const folders = resources.map((resource) => {
      const relevantFolders = publicationFolders.filter((folder) =>
        resource.reviewUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [publicationFolders, resources]);

  return {
    rootFolders,
    publicationFolders,
    conversationsToDisplay,
    highlightedFolders,
    conversations,
  };
};

export const useFilesPublicationResources = (
  resources: PublicationResource[],
) => {
  const files = useAppSelector(FilesSelectors.selectFiles);
  const publicationFolders = useAppSelector(
    FilesSelectors.selectPublicationFolders,
  );

  const resourceUrls = useMemo(
    () => resources.map((r) => r.reviewUrl),
    [resources],
  );

  const filesToDisplay = useMemo(() => {
    return files.filter(
      (f) => f.folderId.split('/').length === 2 && resourceUrls.includes(f.id),
    );
  }, [files, resourceUrls]);

  const rootFolders = useMemo(() => {
    const folders = resources.map((resource) => {
      const relevantFolders = publicationFolders.filter((folder) =>
        resource.reviewUrl.startsWith(folder.id),
      );

      return relevantFolders.find((folder) => isRootId(folder.folderId));
    });

    const existingFolders = folders.filter(Boolean) as FolderInterface[];

    return uniqBy(existingFolders, 'id');
  }, [publicationFolders, resources]);

  return {
    rootFolders,
    publicationFolders,
    filesToDisplay,
    files,
  };
};
