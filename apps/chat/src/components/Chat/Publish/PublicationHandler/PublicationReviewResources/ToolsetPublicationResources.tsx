import { useMemo } from 'react';

import { useAppSelector } from '@/src/store/hooks';
import { ToolsetSelectors } from '@/src/store/selectors';

import { PublicationToolsetRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationToolsetRow';

import { EntityPublicationResourcesProps } from './view-props';

export const ToolsetPublicationResources = ({
  resources,
}: EntityPublicationResourcesProps) => {
  const toolsets = useAppSelector(
    ToolsetSelectors.selectPublishRequestToolsets,
  );

  const filteredToolsets = useMemo(() => {
    const resourcesIds = resources.map((resource) => resource.reviewUrl);

    return toolsets.filter((toolset) => resourcesIds.includes(toolset.id));
  }, [toolsets, resources]);

  return (
    <>
      {filteredToolsets.map((toolset) => (
        <PublicationToolsetRow key={toolset.id} item={toolset} level={0} />
      ))}
    </>
  );
};
