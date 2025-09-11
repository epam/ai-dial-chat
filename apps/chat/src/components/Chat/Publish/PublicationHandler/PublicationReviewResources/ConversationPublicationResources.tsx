import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { PublicationConversationRow } from '@/src/components/Chat/Publish/PublicationHandler/ReviewRowItems/PublicationConversationRow';

import { BasePublicationResources } from './ReviewResources';
import { EntityPublicationResourcesProps } from './view-props';

export const ConversationPublicationResources = ({
  resources,
}: EntityPublicationResourcesProps) => {
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
