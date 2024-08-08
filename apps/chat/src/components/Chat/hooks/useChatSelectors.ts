import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

export const useChatSelectors = () => {
  const isolatedModelId = useAppSelector(
    SettingsSelectors.selectIsolatedModelId,
  );

  return {
    areSelectedConversationsLoaded: useAppSelector(
      ConversationsSelectors.selectAreSelectedConversationsLoaded,
    ),
    selectedConversationsIds: useAppSelector(
      ConversationsSelectors.selectSelectedConversationsIds,
    ),
    selectedConversations: useAppSelector(
      ConversationsSelectors.selectSelectedConversations,
    ),
    modelIsLoaded: useAppSelector(ModelsSelectors.selectIsModelsLoaded),
    isolatedModelId,
    activeModel: useAppSelector((state) =>
      ModelsSelectors.selectModel(state, isolatedModelId || ''),
    ),
    selectedPublication: useAppSelector(
      PublicationSelectors.selectSelectedPublication,
    ),
  };
};
