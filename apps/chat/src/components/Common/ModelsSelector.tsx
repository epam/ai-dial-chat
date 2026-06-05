import { memo, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getOpenAIEntityFullName } from '@/src/utils/app/conversation';

import { EntityType } from '@/src/types/common';
import { DialAIEntityModel, ModelsMap } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

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
        truncate && 'min-w-0 overflow-hidden',
      )}
    >
      <ModelIcon entity={item} entityId={item.id} size={18} />
      <div
        className={classNames(
          'flex flex-1 items-center',
          truncate ? 'min-w-0' : 'flex-wrap gap-x-1.5',
        )}
        data-qa="agent-attributes"
      >
        <span
          className={classNames(truncate && 'min-w-0 flex-1 truncate')}
          data-qa="agent-name"
        >
          {getOpenAIEntityFullName(item)}
        </span>
        {item.version && (
          <span
            className={classNames(
              truncate && 'ms-2 max-w-[50%] shrink-0 truncate text-secondary',
              !truncate && 'text-secondary',
            )}
            data-qa="agent-version"
          >
            {item.version}
          </span>
        )}
        {isNotAllowed && (
          <span className="text-error" data-qa="talk-to-entity-descr">
            <EntityMarkdownDescription isShortDescription>
              {t(ChatI18nKeys.IncorrectSelectedModel)}
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
  showHiddenTagModels?: boolean;
  hideInlineError?: boolean;
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
  showHiddenTagModels,
  hideInlineError,
}: ModelsSelectorProps) {
  const modelTypeAgents = useAppSelector((state) =>
    ModelsSelectors.selectModelTypeAgents(state, showHiddenTagModels),
  );
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
          selectedItem={
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
              isNotAllowed={!hideInlineError && item.id === value && !model}
              truncate={truncate}
            />
          )}
          onSelectItem={onChange}
        />
      </div>
    </Tooltip>
  );
});
