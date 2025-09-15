import { useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/selectors';

import { PublicationPromptRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationPromptRow';

import { BasePublicationResources } from './ReviewResources';
import { EntityPublicationResourcesProps } from './view-props';

export const PromptPublicationResources = ({
  resources,
}: EntityPublicationResourcesProps) => {
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
