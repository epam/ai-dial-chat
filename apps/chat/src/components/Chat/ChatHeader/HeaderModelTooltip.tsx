import { useTranslation } from '@/src/hooks/useTranslation';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

interface Props {
  model: DialAIEntityModel | undefined;
  conversationModelId: string;
  disallowChangeAgent: boolean;
}

export const HeaderModelTooltip = ({
  model,
  conversationModelId,
  disallowChangeAgent,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);
  const locale = useAppSelector(UISelectors.selectLocale);

  return (
    <div
      className="grid max-w-[880px] grid-cols-1 p-2"
      data-qa="chat-model-tooltip"
    >
      <div className="font-semibold" data-qa="tooltip-title">
        {t(
          disallowChangeAgent
            ? ChatI18nKeys.CurrentAgent
            : ChatI18nKeys.ChangeCurrentAgent,
        )}
        :
      </div>
      <div className="mt-3 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
        <>
          <span className="text-secondary">{t(ChatI18nKeys.Agent)}:</span>
          <div data-qa="entity-info">
            {getOpenAIEntityFullName(
              model ?? { id: conversationModelId },
              locale,
            )}
          </div>
        </>
        {model?.version && (
          <>
            <span className="text-secondary">{t(ChatI18nKeys.Version)}:</span>
            <div data-qa="version-info">{model.version}</div>
          </>
        )}
      </div>
    </div>
  );
};
