import { useMemo } from 'react';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { PublicationApplicationRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationApplicationRow';

import { EntityPublicationResourcesProps } from './view-props';

export const ApplicationPublicationResources = ({
  resources,
}: EntityPublicationResourcesProps) => {
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
