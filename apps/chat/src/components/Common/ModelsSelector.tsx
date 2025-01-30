import { memo, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Combobox } from '@/src/components/Common/Combobox';
import { DisableOverlay } from '@/src/components/Common/DisableOverlay';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

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

interface ModelsSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
}

export const ModelsSelector = memo(function ModelsSelector({
  value,
  onChange,
  disabled,
}: ModelsSelectorProps) {
  const onlyModels = useAppSelector(ModelsSelectors.selectModelsOnly);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const model = useMemo(() => modelsMap[value], [value, modelsMap]);

  return (
    <div className="relative">
      {disabled && <DisableOverlay />}
      <Combobox
        items={onlyModels}
        initialSelectedItem={
          model || {
            name: value,
            isDefault: false,
            type: EntityType.Model,
            id: value,
            reference: value,
          }
        }
        getItemLabel={(model: DialAIEntityModel) =>
          getOpenAIEntityFullName(model)
        }
        getItemValue={(model: DialAIEntityModel) => model.id}
        itemRow={({ item }) => (
          <ModelSelectRow
            item={item}
            isNotAllowed={item.id === value && !model}
          />
        )}
        onSelectItem={onChange}
      />
    </div>
  );
});
