import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel } from '@/src/types/openai';
import { Translation } from '@/src/types/translation';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { EntityMarkdownDescription } from '../Common/MarkdownDescription';

interface Props {
  model: OpenAIEntityModel;
}

export const ModelDescription = ({ model }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex flex-col gap-3" data-qa="more-info">
      <span>{t('More info')}</span>
      <div className="flex items-center gap-2" data-qa="info-app">
        <ModelIcon entity={model} entityId={model.id} size={24} />
        <span>{model.name}</span>
      </div>
      {model.description && (
        <span className="text-xs text-secondary" data-qa="app-descr">
          <EntityMarkdownDescription>
            {model.description}
          </EntityMarkdownDescription>
        </span>
      )}
    </div>
  );
};
