import { useTranslation } from 'next-i18next';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '../Chatbar/ModelIcon';

import { ConversationEntityModel } from '@epam/ai-dial-shared';

interface Props {
  model: DialAIEntityModel | ConversationEntityModel;
}

const getModelTemplate = (
  model: DialAIEntityModel | ConversationEntityModel,
  label: string,
) => (
  <>
    <span className="text-secondary">{label}:</span>
    <div
      className="flex items-center gap-2"
      data-qa={label.toLowerCase().concat('-info')}
    >
      <ModelIcon
        entityId={model.id}
        entity={model as DialAIEntityModel}
        size={18}
      />
      {getOpenAIEntityFullName(model as DialAIEntityModel)}
    </div>
  </>
);

const getModelLabel = (type?: EntityType) => {
  switch (type) {
    case EntityType.Application:
      return 'Application';
    case EntityType.Assistant:
      return 'Assistant';
    default:
      return 'Model';
  }
};

export const ChatInfoTooltip = ({ model }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div
      className="grid max-w-[880px] grid-cols-[max-content_1fr] gap-4 px-2 py-3"
      data-qa="chat-info-tooltip"
    >
      {model &&
        getModelTemplate(
          model,
          t(getModelLabel((model as DialAIEntityModel).type)),
        )}
      {(model as DialAIEntityModel).version && (
        <>
          <span className="text-secondary">{t('Version')}:</span>
          <div data-qa="version-info">
            {(model as DialAIEntityModel).version}
          </div>
        </>
      )}
    </div>
  );
};
