import { useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { PublicationFileRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationFileRow';

import { BasePublicationResources } from './ReviewResources';
import { EntityPublicationResourcesProps } from './view-props';

export const FilePublicationResources = ({
  resources,
}: EntityPublicationResourcesProps) => {
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
