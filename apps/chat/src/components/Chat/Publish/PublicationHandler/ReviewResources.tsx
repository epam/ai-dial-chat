import { useMemo } from 'react';

import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import { DialFile } from '@/src/types/files';
import { PublicationResource } from '@/src/types/publication';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { PublicationResourceItem } from './PublicationResourceItem';
import { PublicationFolderRow } from './ReviewRowItems/PublicationFolderRow';

import {
  ConversationInfo,
  FolderInterface,
  Prompt,
  ShareEntity,
} from '@epam/ai-dial-shared';

interface Props {
  resources: PublicationResource[];
}

interface BasePublicationResources extends Props {
  entities: ShareEntity[] | Prompt[] | ConversationInfo[] | DialFile[];
  folders: FolderInterface[];
}

const BasePublicationResources: React.FC<BasePublicationResources> = ({
  resources,
  entities,
  folders,
}) => {
  const {
    rootPublicationFolders,
    allPublicationFolders,
    itemsToDisplay,
    folderItemsToDisplay,
  } = usePublicationResources(folders, resources, entities);

  return (
    <>
      {rootPublicationFolders.map((folder) => (
        <PublicationFolderRow
          key={folder.id}
          currentFolder={folder}
          allFolders={allPublicationFolders}
          allItems={folderItemsToDisplay}
          itemComponent={PublicationResourceItem}
          level={0}
        />
      ))}
      {itemsToDisplay.map((item) => (
        <PublicationResourceItem key={item.id} item={item} level={0} />
      ))}
    </>
  );
};

export const PromptPublicationResources = ({ resources }: Props) => {
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);

  return (
    <BasePublicationResources
      resources={resources}
      entities={prompts}
      folders={allFolders}
    />
  );
};

export const ConversationPublicationResources = ({ resources }: Props) => {
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);

  return (
    <BasePublicationResources
      resources={resources}
      entities={conversations}
      folders={allFolders}
    />
  );
};

export const FilePublicationResources = ({ resources }: Props) => {
  const files = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);

  return (
    <BasePublicationResources
      resources={resources}
      entities={files}
      folders={allFolders}
    />
  );
};

export const ApplicationPublicationResources = ({ resources }: Props) => {
  const publishRequestModels = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );

  const filteredApps = useMemo(() => {
    const resourcesIds = resources.map((resource) => resource.reviewUrl);

    return publishRequestModels.filter((model) =>
      resourcesIds.includes(model.id),
    );
  }, [publishRequestModels, resources]);

  return (
    <>
      {filteredApps.map((application) => (
        <PublicationResourceItem
          key={application.id}
          item={application}
          level={0}
        />
      ))}
    </>
  );
};
