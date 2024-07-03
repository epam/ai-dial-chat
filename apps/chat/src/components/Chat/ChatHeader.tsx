import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ApplicationsActionsList } from '@/src/components/Chat/ApplicationsActions';
import { ModelListSelector } from '@/src/components/Chat/ModelListSelector';

interface Props {
  conversation: Conversation;
  onChangeTemperature: (temperature: number) => void;
  onSelectModel: (modelId: string) => void;
  onSelectAssistantSubModel?: (modelId: string) => void;
  onCreateNewConversation: (modelId: string) => void;
  onUpdateFavoriteApp: (modelId: string, isFavorite: boolean) => void;
}

export const ChatHeader = ({
  conversation,
  onChangeTemperature,
  onSelectModel,
  onCreateNewConversation,
  onUpdateFavoriteApp,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const favoriteAppIds = useAppSelector(
    ModelsSelectors.selectFavoriteApplicationsIds,
  );
  const modelId = conversation.model.id;
  const model = modelsMap[modelId];

  if (!model) return null;

  return (
    <>
      <div
        className={classNames(
          'sticky top-0 z-10 flex w-full min-w-0 items-center p-3 px-3 md:flex-wrap md:px-5 lg:flex-row',
          {
            'lg:flex-nowrap': isChatFullWidth,
          },
        )}
        data-qa="chat-header"
      >
        <div className={classNames('flex items-center md:min-w-[180px]')}>
          {model.type === EntityType.Application ? (
            <ApplicationsActionsList
              model={model}
              onCreateNewConversation={onCreateNewConversation}
              onUpdateFavoriteApp={onUpdateFavoriteApp}
              isFavoriteApp={favoriteAppIds.includes(model.id)}
              t={t}
            />
          ) : (
            <ModelListSelector
              modelId={modelId}
              onModelSelect={(modelId: string) => {
                onSelectModel(modelId);
              }}
              temperature={conversation.temperature}
              onChangeTemperature={onChangeTemperature}
            />
          )}
        </div>
      </div>
    </>
  );
};
