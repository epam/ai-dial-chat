import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { ModelIconMappingType } from '@/types/icons';
import { OpenAIEntityAddon, OpenAIEntityModel } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

interface Props {
  model: OpenAIEntityModel;
  selectedAddons: OpenAIEntityAddon[] | null;
  subModel: OpenAIEntityModel | undefined | null;
  prompt: string | null;
  temperature: number | null;
  modelIconMapping: ModelIconMappingType;
}

const getModelTemplate = (
  model: OpenAIEntityModel,
  lightMode: 'dark' | 'light',
  label: string,
  modelIconMapping: ModelIconMappingType,
) => {
  return (
    <>
      <span className="text-gray-500">{label}:</span>
      <div className="flex items-center gap-2">
        <ModelIcon
          modelIconMapping={modelIconMapping}
          modelId={model.id}
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
  modelIconMapping,
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
      {model &&
        getModelTemplate(model, lightMode, getModelLabel(), modelIconMapping)}
      {subModel != null &&
        getModelTemplate(
          subModel,
          lightMode,
          t('Assistant model'),
          modelIconMapping,
        )}
      {prompt && (
        <>
          <span className="text-gray-500">{t('System Prompt')}:</span>
          <div>{prompt}</div>
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
          <div>
            {selectedAddons.map((addon) => (
              <span key={addon.id}>{addon.name}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
