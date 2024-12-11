import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '../../Chatbar/ModelIcon';
import { Combobox } from '../../Common/Combobox';
import { DisableOverlay } from '../../Common/DisableOverlay';
import { EntityMarkdownDescription } from '../../Common/MarkdownDescription';

interface ModelSelectRowProps {
  item: DialAIEntityModel;
  isNotAllowed: boolean;
}

const ModelSelectRow = ({ item, isNotAllowed }: ModelSelectRowProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div
      className={classNames(
        'flex items-center gap-2 truncate',
        isNotAllowed && 'text-secondary',
      )}
    >
      <ModelIcon entity={item} entityId={item.id} size={18} />
      <div className="truncate">
        <span>
          {getOpenAIEntityFullName(item)}
          {item.version && (
            <span className="ml-2 text-secondary">{item.version}</span>
          )}
        </span>
        {isNotAllowed && (
          <span className="text-error" data-qa="talk-to-entity-descr">
            <EntityMarkdownDescription isShortDescription>
              {t('chat.error.incorrect-selected', {
                context: EntityType.Model,
              })}
            </EntityMarkdownDescription>
          </span>
        )}
      </div>
    </div>
  );
};

interface Props {
  assistantModelId: string;
  onSelectAssistantSubModel: (modelId: string) => void;
  disabled?: boolean;
}

export const AssistantSubModelSelector = ({
  assistantModelId,
  onSelectAssistantSubModel,
  disabled,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const onlyModels = useAppSelector(ModelsSelectors.selectModelsOnly);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const assistantSubModel = useMemo(
    () => modelsMap[assistantModelId],
    [assistantModelId, modelsMap],
  );

  return (
    <>
      <label className="mb-4 inline-block text-left">{t('Model')}</label>
      <div className="relative">
        {disabled && <DisableOverlay />}
        <Combobox
          items={onlyModels}
          initialSelectedItem={
            assistantSubModel || {
              name: assistantModelId,
              isDefault: false,
              type: EntityType.Model,
              id: assistantModelId,
              reference: assistantModelId,
            }
          }
          getItemLabel={(model: DialAIEntityModel) =>
            getOpenAIEntityFullName(model)
          }
          getItemValue={(model: DialAIEntityModel) => model.id}
          itemRow={({ item }) => (
            <ModelSelectRow
              item={item}
              isNotAllowed={item.id === assistantModelId && !assistantSubModel}
            />
          )}
          onSelectItem={(itemID: string) => {
            onSelectAssistantSubModel(itemID);
          }}
        />
      </div>
    </>
  );
};
