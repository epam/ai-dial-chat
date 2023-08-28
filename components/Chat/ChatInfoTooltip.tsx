import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { OpenAIEntityAddon, OpenAIEntityModel } from '@/types/openai';

import { useAppSelector } from '@/store/hooks';
import { uiSelectors } from '@/store/ui-store/ui.reducers';

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
  theme: 'dark' | 'light',
  label: string,
) => {
  return (
    <>
      <span className="text-gray-500">{label}:</span>
      <div className="flex items-center gap-2">
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
  //New Redux state
  const theme = useAppSelector(uiSelectors.selectThemeState);

  const { t } = useTranslation('chat');
  const getModelLabel = useCallback(() => {
    switch (model.type) {
      case 'application':
        return t('Application');
      case 'assistant':
        return t('Assistant');
      default:
        return t('Model');
    }
  }, [model.type]);

  return (
    <div className="grid max-w-[880px] grid-cols-[max-content_1fr] gap-4 px-2 py-3">
      {model && getModelTemplate(model, theme, getModelLabel())}
      {subModel != null &&
        getModelTemplate(subModel, theme, t('Assistant model'))}
      {prompt && (
        <>
          <span className="text-gray-500">{t('System prompt')}:</span>
          <div className="whitespace-pre-wrap">{prompt}</div>
        </>
      )}
      {temperature !== null && (
        <>
          <span className="text-gray-500">{t('Temperature')}:</span>
          <div>{temperature}</div>
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
