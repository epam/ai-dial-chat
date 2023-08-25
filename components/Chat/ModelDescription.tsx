import { useTranslation } from 'react-i18next';

import { OpenAIEntityModel } from '@/types/openai';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { EntityMarkdownDescription } from '../Common/MarkdownDescription';

import { useAppSelector } from '@/store/hooks';
import { selectThemeState } from '@/store/ui-store/ui.reducers';

interface Props {
  model: OpenAIEntityModel;
}

export const ModelDescription = ({ model }: Props) => {
  //New Redux state
  const theme = useAppSelector(selectThemeState);

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
