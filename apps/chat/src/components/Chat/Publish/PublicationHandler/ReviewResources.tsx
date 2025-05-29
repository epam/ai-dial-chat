import { useMemo } from 'react';

import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import {
  PublicationResource,
  PublicationReviewItem,
} from '@/src/types/publication';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { PublicationApplicationRow } from './ReviewRowItems/PublicationApplicationRow';
import { PublicationConversationRow } from './ReviewRowItems/PublicationConversationRow';
import { PublicationFileRow } from './ReviewRowItems/PublicationFileRow';
import { PublicationFolderRow } from './ReviewRowItems/PublicationFolderRow';
import { PublicationPromptRow } from './ReviewRowItems/PublicationPromptRow';

import { FolderInterface } from '@epam/ai-dial-shared';

interface Props {
  resources: PublicationResource[];
}

interface BasePublicationResources<T extends PublicationReviewItem>
  extends Props {
  entities: T[];
  folders: FolderInterface[];
  ItemComponent: React.FC<{ item: T; level: number }>;
}

const BasePublicationResources = <T extends PublicationReviewItem>({
  resources,
  entities,
  folders,
  ItemComponent,
}: BasePublicationResources<T>) => {
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
          ItemComponent={ItemComponent}
          level={0}
        />
      ))}
      {itemsToDisplay.map((item) => {
        return <ItemComponent key={item.id} item={item} level={0} />;
      })}
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
      ItemComponent={PublicationPromptRow}
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
      ItemComponent={PublicationConversationRow}
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
      ItemComponent={PublicationFileRow}
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
        <PublicationApplicationRow
          key={application.id}
          item={application}
          level={0}
        />
      ))}
    </>
  );
};
