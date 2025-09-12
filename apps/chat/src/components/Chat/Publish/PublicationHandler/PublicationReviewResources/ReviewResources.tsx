import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import {
  PublicationResource,
  PublicationReviewItem,
} from '@/src/types/publication';

import { PublicationFolderRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationFolderRow';

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

export const BasePublicationResources = <T extends PublicationReviewItem>({
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
