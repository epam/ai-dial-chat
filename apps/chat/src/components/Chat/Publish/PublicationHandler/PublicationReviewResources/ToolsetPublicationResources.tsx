import { useMemo } from 'react';

import { PublishRequestDialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { PublicationToolsetRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationToolsetRow';

import { EntityPublicationResourcesProps } from './view-props';

import uniqBy from 'lodash-es/uniqBy';

export const ToolsetPublicationResources = ({
  resources,
}: EntityPublicationResourcesProps) => {
  const publishRequestToolsets = useAppSelector(
    ToolsetSelectors.selectPublishRequestToolsets,
  );
  const toolsets = useAppSelector(ToolsetSelectors.selectToolsets);

  const filteredToolsets = useMemo(() => {
    const resourcesIds = resources.map((resource) => resource.reviewUrl);

    return uniqBy(
      [...publishRequestToolsets, ...toolsets].filter((toolset) =>
        resourcesIds.includes(toolset.id),
      ),
      (item) => item.id,
    );
  }, [publishRequestToolsets, toolsets, resources]);

  return (
    <>
      {filteredToolsets.map((toolset) => (
        <PublicationToolsetRow
          key={toolset.id}
          item={toolset as PublishRequestDialAIEntityModel}
          level={0}
        />
      ))}
    </>
  );
};
