import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { OpenAIEntityAddon, OpenAIEntityModel } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

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
  lightMode: 'dark' | 'light',
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
          inverted={lightMode === 'dark'}
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
  const {
    state: { lightMode },
  } = useContext(HomeContext);
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
      {model && getModelTemplate(model, lightMode, getModelLabel())}
      {subModel != null &&
        getModelTemplate(subModel, lightMode, t('Assistant model'))}
      {prompt && (
        <>
          <span className="text-gray-500">{t('System Prompt')}:</span>
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
                  inverted={lightMode === 'dark'}
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
