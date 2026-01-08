import { memo, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntityModel, ModelsMap } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Combobox } from '@/src/components/Common/Combobox';
import { DisableOverlay } from '@/src/components/Common/DisableOverlay';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import { Tooltip } from '@/src/components/Common/Tooltip';

interface ModelSelectRowProps {
  item: DialAIEntityModel;
  isNotAllowed: boolean;
  truncate?: boolean;
}

const ModelSelectRow = ({
  item,
  isNotAllowed,
  truncate = true,
}: ModelSelectRowProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div
      className={classNames(
        'flex items-center gap-2',
        isNotAllowed && 'text-secondary',
        truncate && 'truncate',
      )}
    >
      <ModelIcon entity={item} entityId={item.id} size={18} />
      <div
        className={classNames(truncate && 'truncate')}
        data-qa="agent-attributes"
      >
        <span>
          {getOpenAIEntityFullName(item)}
          {item.version && (
            <span className="ml-2 text-secondary" data-qa="agent-version">
              {item.version}
            </span>
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
  disabled?: boolean;
  tooltip?: string;
  onChange: (modelId: string) => void;
  models?: DialAIEntityModel[];
  additionalModelsMap?: ModelsMap;
  inputClassName?: string;
  panelClassName?: string;
  indexSeparator?: number;
}

export const ModelsSelector = memo(function ModelsSelector({
  value,
  disabled,
  tooltip,
  onChange,
  models,
  additionalModelsMap,
  inputClassName,
  panelClassName,
  indexSeparator,
}: ModelsSelectorProps) {
  const modelTypeAgents = useAppSelector(ModelsSelectors.selectModelTypeAgents);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const displayedModels = models ?? modelTypeAgents;

  const model = useMemo(
    () => modelsMap[value] || additionalModelsMap?.[value],
    [modelsMap, value, additionalModelsMap],
  );

  return (
    <Tooltip triggerClassName="w-full" tooltip={tooltip}>
      <div className="relative">
        {disabled && <DisableOverlay />}
        <Combobox
          inputClassName={inputClassName}
          panelClassName={panelClassName}
          indexSeparator={indexSeparator}
          items={displayedModels}
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
          getItemValue={(model: DialAIEntityModel) => model.reference}
          itemRow={({ item, truncate }) => (
            <ModelSelectRow
              item={item}
              isNotAllowed={item.id === value && !model}
              truncate={truncate}
            />
          )}
          onSelectItem={onChange}
        />
      </div>
    </Tooltip>
  );
});
