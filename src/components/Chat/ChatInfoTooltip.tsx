import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityAddon, OpenAIEntityModel } from '@/src/types/openai';
import { Theme } from '@/src/types/settings';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

interface Props {
  model: OpenAIEntityModel;
  selectedAddons: OpenAIEntityAddon[] | null;
  subModel: OpenAIEntityModel | undefined | null;
  prompt: string | null;
  temperature: number | null;
}

const getModelTemplate = (
  model: OpenAIEntityModel,
  theme: Theme,
  label: string,
) => {
  return (
    <>
      <span className="text-gray-500">{label}:</span>
      <div
        className="flex items-center gap-2"
        data-qa={label.toLowerCase().concat('-info')}
      >
        <ModelIcon
          entityId={model.id}
          entity={model}
          size={18}
          inverted={theme === 'dark'}
        />
        {model.name}
      </div>
    </>
  );
};

export const ChatInfoTooltip = ({
  model,
  subModel,
  selectedAddons,
  prompt,
  temperature,
}: Props) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  const { t } = useTranslation('chat');
  const getModelLabel = useCallback(() => {
    switch (model.type) {
      case EntityType.Application:
        return t('Application');
      case EntityType.Assistant:
        return t('Assistant');
      default:
        return t('Model');
    }
  }, [model.type, t]);

  return (
    <div
      className="grid max-w-[880px] grid-cols-[max-content_1fr] gap-4 px-2 py-3"
      data-qa="chat-info-tooltip"
    >
      {model && getModelTemplate(model, theme, getModelLabel())}
      {subModel != null &&
        getModelTemplate(subModel, theme, t('Assistant model'))}
      {prompt && (
        <>
          <span className="text-gray-500">{t('System prompt')}:</span>
          <div className="whitespace-pre-wrap" data-qa="prompt-info">
            {prompt}
          </div>
        </>
      )}
      {temperature !== null && (
        <>
          <span className="text-gray-500">{t('Temperature')}:</span>
          <div data-qa="temp-info">{temperature}</div>
        </>
      )}
      {selectedAddons !== null && selectedAddons?.length > 0 && (
        <>
          <span className="text-gray-500">{t('Addons')}:</span>
          <div className="flex flex-wrap gap-1">
            {selectedAddons.map((addon) => (
              <span
                key={addon.id}
                className="flex gap-2 rounded bg-blue-500/20 px-3 py-2"
                data-qa="addons-info"
              >
                <ModelIcon
                  entityId={addon.id}
                  entity={addon}
                  size={18}
                  inverted={theme === 'dark'}
                />
                {addon.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
