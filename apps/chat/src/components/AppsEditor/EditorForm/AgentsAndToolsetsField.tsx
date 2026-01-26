import { FC, useCallback, useMemo, useState } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getEntityDisplayName,
  isDialAiEntityModel,
} from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { AnyToolset } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.selectors';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { ToolsetSelectors } from '@/src/store/toolset/toolset.selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/applications';

import {
  QuickApp2Form as QuickApp2FormType,
  getAgentOrToolsetOption,
  getAgentsAndToolsetsFormValue,
  getQuickApp2Toolsets,
} from '@/src/components/AppsEditor/form';
import { AgentAndToolsetSelector } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetSelector';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';
import { ApplicationDetails } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { SimpleApplicationDetailsFooter } from '@/src/components/Marketplace/ApplicationDetails/SimpleApplicationDetailsFooter';
import { SimpleToolsetDetailsFooter } from '@/src/components/Marketplace/ToolsetsDetails/SimpleToolsetDetailsFooter';
import { ToolsetDetails } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

import sortBy from 'lodash-es/sortBy';

const AgentAndToolsetSelectorField = withErrorMessage(
  withLabel(AgentAndToolsetSelector),
);
const JsonEditor = withErrorMessage(withLabel(MonacoEditor));

interface AgentsAndToolsetsFieldProps {
  onAutoSave: () => void;
}

export const AgentsAndToolsetsField: FC<AgentsAndToolsetsFieldProps> = ({
  onAutoSave,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);
  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const { control, setValue, getValues } = useFormContext<QuickApp2FormType>();
  const { errors } = useFormState<QuickApp2FormType>({ control });

  const isJsonView = useWatch({
    control,
    name: 'isJsonView',
  });

  const agentsAndToolsetsOptions = useWatch({
    control,
    name: 'agentsAndToolsets',
  });

  const agentsAndToolsetsJson = useWatch({
    control,
    name: 'agentsAndToolsetsJson',
  });

  const editorOptions = useMemo(
    () => ({
      readOnly: isAppPublic,
    }),
    [isAppPublic],
  );

  const allEntitiesMap = useMemo(
    () => ({
      ...modelsMap,
      ...toolsetsMap,
    }),
    [modelsMap, toolsetsMap],
  );

  const sortedAgentsAndToolsets = useMemo(() => {
    const ids = [...(agentsAndToolsetsOptions.map(({ id }) => id) || [])];

    const itemsWithName = ids.map((id) => ({
      id: id,
      name: getEntityDisplayName(id, allEntitiesMap),
    }));

    const sortedItems = sortBy(itemsWithName, [
      (item) => item.name.toLowerCase(),
    ]);

    return sortedItems.map((item) => item.id);
  }, [agentsAndToolsetsOptions, allEntitiesMap]);

  const detailedViewEntity = useMemo(
    () => (selectedEntityId ? allEntitiesMap[selectedEntityId] : null),
    [selectedEntityId, allEntitiesMap],
  );

  const handleJsonViewChange = useCallback(() => {
    if (isJsonView) {
      setValue(
        'agentsAndToolsets',
        getAgentsAndToolsetsFormValue(
          JSON.parse(agentsAndToolsetsJson) as AnyToolset[],
        ),
      );
    } else {
      setValue(
        'agentsAndToolsetsJson',
        JSON.stringify(
          getQuickApp2Toolsets({
            data: getValues(),
            allEntitiesMap: allEntitiesMap as Record<string, MarketplaceEntity>,
          }),
          null,
          2,
        ),
      );
    }
    setValue('isJsonView', !isJsonView, {
      shouldDirty: false,
      shouldValidate: true,
    });
  }, [agentsAndToolsetsJson, allEntitiesMap, getValues, isJsonView, setValue]);

  const handleAgentsAndToolsetsChange = useCallback(
    (value: string[]) => {
      const processedValue = value.map((id) => ({
        id,
        tool:
          agentsAndToolsetsOptions.find((option) => option.id === id)?.tool ??
          getAgentOrToolsetOption(id),
      }));
      setValue('agentsAndToolsets', processedValue, {
        shouldTouch: true,
        shouldDirty: true,
      });
    },
    [agentsAndToolsetsOptions, setValue],
  );

  const handleOpenDetails = useCallback(
    (entity: MarketplaceEntity) => {
      setSelectedEntityId(entity.id);
      onAutoSave();
    },
    [onAutoSave],
  );

  const handleCloseDetails = useCallback(() => {
    setSelectedEntityId(null);
  }, []);

  const handleChangeVersionInDetails = useCallback(
    (entity: MarketplaceEntity) => {
      setSelectedEntityId(entity.id);
    },
    [],
  );

  const handleRemoveFromDetails = useCallback(
    (entityToRemove: MarketplaceEntity) => {
      const currentValue = getValues('agentsAndToolsets') || [];
      setValue(
        'agentsAndToolsets',
        currentValue.filter(({ id }) => id !== entityToRemove.id),
        { shouldTouch: true, shouldDirty: true },
      );
      handleCloseDetails();
    },
    [getValues, setValue, handleCloseDetails],
  );

  const handleItemClick = useCallback(
    (id: string) => {
      const entity = allEntitiesMap[id];
      if (entity) {
        handleOpenDetails(entity);
      }
    },
    [allEntitiesMap, handleOpenDetails],
  );

  const commonDetailsProps = useMemo(
    () => ({
      onClose: handleCloseDetails,
      onChangeVersion: handleChangeVersionInDetails,
      onRemove: handleRemoveFromDetails,
      isPreview: true,
    }),
    [handleCloseDetails, handleChangeVersionInDetails, handleRemoveFromDetails],
  );

  return (
    <div>
      <Controller
        name="isJsonView"
        control={control}
        render={({ field }) => (
          <ToggleSwitch
            disabled={field.value && !!errors.agentsAndToolsetsJson}
            isOn={field.value}
            handleSwitch={handleJsonViewChange}
            switchOnText={t('ON')}
            switchOFFText={t('OFF')}
            additionalText={t('JSON view')}
            className="mb-2 flex w-fit items-center gap-2"
            tooltip={
              field.value && !!errors.agentsAndToolsetsJson
                ? t('Fix JSON config before switching to simple mode')
                : ''
            }
          />
        )}
      />

      <Controller
        name="agentsAndToolsetsJson"
        control={control}
        render={({ field }) => (
          <div
            className={classNames({
              'invisible h-0 overflow-hidden': !isJsonView,
            })}
          >
            <JsonEditor
              label={t('Agents & Toolsets')}
              error={errors.agentsAndToolsetsJson?.message}
              height={200}
              allowFullScreen
              onChange={field.onChange}
              value={field.value}
              language="json"
              options={editorOptions}
            />
          </div>
        )}
      />

      <Controller
        name="agentsAndToolsets"
        control={control}
        render={() => {
          return (
            <>
              <div
                className={classNames({
                  'invisible h-0 overflow-hidden': isJsonView,
                })}
              >
                <AgentAndToolsetSelectorField
                  value={sortedAgentsAndToolsets}
                  onChange={handleAgentsAndToolsetsChange}
                  allItemsMap={allEntitiesMap}
                  label={t('Agents & Toolsets')}
                  readonly={isAppPublic}
                  tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
                  onItemClick={handleItemClick}
                />
              </div>
              {detailedViewEntity &&
                isDialAiEntityModel(detailedViewEntity) && (
                  <ApplicationDetails
                    entity={detailedViewEntity}
                    allEntities={allModels}
                    FooterComponent={SimpleApplicationDetailsFooter}
                    {...commonDetailsProps}
                  />
                )}

              {detailedViewEntity &&
                isToolsetEntityModel(detailedViewEntity) && (
                  <ToolsetDetails
                    entity={detailedViewEntity}
                    allEntities={allToolsets}
                    FooterComponent={SimpleToolsetDetailsFooter}
                    {...commonDetailsProps}
                  />
                )}
            </>
          );
        }}
      />
    </div>
  );
};
