import { useTranslation } from 'next-i18next';

import { OpenAIEntityModel } from '@/types/openai';

import { useAppSelector } from '@/store/hooks';
import { UISelectors } from '@/store/ui-store/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { EntityMarkdownDescription } from '../Common/MarkdownDescription';

interface Props {
  model: OpenAIEntityModel;
}

export const ModelDescription = ({ model }: Props) => {
  const theme = useAppSelector(UISelectors.selectThemeState);

  const { t } = useTranslation('chat');

  return (
    <div className="flex flex-col gap-3">
      <span>{t('More info')}</span>
      <div className="flex items-center gap-2">
        <ModelIcon
          entity={model}
          entityId={model.id}
          size={24}
          inverted={theme === 'dark'}
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
