import { useTranslation } from 'next-i18next';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

interface Props {
  model: DialAIEntityModel | undefined;
  conversationModelId: string;
}

export const HeaderModelTooltip = ({ model, conversationModelId }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div
      className="grid max-w-[880px] grid-cols-1 p-2"
      data-qa="chat-model-tooltip"
    >
      <div className="font-semibold">{t('Change current agent')}:</div>
      <div className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
        <>
          <span className="text-secondary">{t('Agent')}:</span>
          <div data-qa="agent-info">
            {getOpenAIEntityFullName(model ?? { id: conversationModelId })}
          </div>
        </>
        {model?.version && (
          <>
            <span className="text-secondary">{t('Version')}:</span>
            <div data-qa="version-info">{model.version}</div>
          </>
        )}
      </div>
    </div>
  );
};
