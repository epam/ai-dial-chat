import { useContext } from 'react';
import { useTranslation } from 'react-i18next';

import { OpenAIEntityModel } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { EntityMarkdownDescription } from '../Common/MarkdownDescription';

interface Props {
  model: OpenAIEntityModel;
}

export const ModelDescription = ({ model }: Props) => {
  const { t } = useTranslation('chat');
  const {
    state: { lightMode },
  } = useContext(HomeContext);
  return (
    <div className="flex flex-col gap-3">
      <span>{t('More info')}</span>
      <div className="flex items-center gap-2">
        <ModelIcon
          entity={model}
          entityId={model.id}
          size={24}
          inverted={lightMode === 'dark'}
        />
        <span>{model.name}</span>
      </div>
      {model.description && (
        <span className="text-xs text-gray-500">
          <EntityMarkdownDescription>
            {model.description}
          </EntityMarkdownDescription>
        </span>
      )}
    </div>
  );
};
