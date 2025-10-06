import { useMemo } from 'react';

import { PublishRequestDialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { PublicationApplicationRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationApplicationRow';

import { EntityPublicationResourcesProps } from './view-props';

import uniqBy from 'lodash-es/uniqBy';

export const ApplicationPublicationResources = ({
  resources,
}: EntityPublicationResourcesProps) => {
  const publishRequestModels = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );
  const models = useAppSelector(ModelsSelectors.selectModels);

  const filteredApps = useMemo(() => {
    const resourcesIds = resources.map((resource) => resource.reviewUrl);

    return uniqBy(
      [...publishRequestModels, ...models].filter((model) =>
        resourcesIds.includes(model.id),
      ),
      (item) => item.id,
    );
  }, [publishRequestModels, models, resources]);

  return (
    <>
      {filteredApps.map((application) => (
        <PublicationApplicationRow
          key={application.id}
          item={application as PublishRequestDialAIEntityModel}
          level={0}
        />
      ))}
    </>
  );
};
