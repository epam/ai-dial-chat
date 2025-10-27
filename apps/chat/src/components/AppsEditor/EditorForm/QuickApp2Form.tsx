import { useCallback, useMemo, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';
import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { CONFIRM_DOCUMENT_VALUES } from '@/src/constants/applications';
import { PUBLIC_APP_TOOLTIP } from '@/src/constants/code-apps';

import { QuickApp2Form as QuickApp2FormType } from '@/src/components/AppsEditor/form';
import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { AgentAndToolsetSelector } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetSelector';
import { FilesSelector } from '@/src/components/Common/FilesSelector/FilesSelector';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';
import { ApplicationDetails } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { SimpleApplicationDetailsFooter } from '@/src/components/Marketplace/ApplicationDetails/SimpleApplicationDetailsFooter';
import { SimpleToolsetDetailsFooter } from '@/src/components/Marketplace/ToolsetsDetails/SimpleToolsetDetailsFooter';
import { ToolsetDetails } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));
const AgentAndToolsetSelectorField = withErrorMessage(
  withLabel(AgentAndToolsetSelector),
);
const ToggleSwitchField = withLabel(ToggleSwitch);

function isApplicationOrModel(
  entity: MarketplaceEntity,
): entity is DialAIEntityModel {
  return entity.type === 'application' || entity.type === 'model';
}

function isToolset(entity: MarketplaceEntity): entity is ToolsetModel {
  return entity.type === 'toolset';
}

export const QuickApp2Form = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);

  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);

  const allEntitiesMap = useMemo(
    () => ({
      ...modelsMap,
      ...toolsetsMap,
    }),
    [modelsMap, toolsetsMap],
  );

  const { control, formState, register } = useFormContext<QuickApp2FormType>();
  const errors = formState.errors;

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const detailedViewEntity = useMemo(
    () => (selectedEntityId ? allEntitiesMap[selectedEntityId] : null),
    [selectedEntityId, allEntitiesMap],
  );

  const handleOpenDetails = useCallback((entity: MarketplaceEntity) => {
    setSelectedEntityId(entity.id);
  }, []);

  const handleCloseDetails = useCallback(() => {
    setSelectedEntityId(null);
  }, []);

  const handleChangeVersionInDetails = useCallback(
    (entity: MarketplaceEntity) => {
      setSelectedEntityId(entity.id);
    },
    [],
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

  return (
    <div
      className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5"
      data-qa="app-view-form"
    >
      <Controller
        name="documentRelativeUrl"
        control={control}
        render={({ field }) => (
          <FilesSelectorField
            label={t('Document relative URLs')}
            onAddFiles={(documents) =>
              field.onChange(uniq([...(field.value ?? []), ...documents]))
            }
            onRemoveFile={(document) =>
              field.onChange(field.value?.filter((field) => field !== document))
            }
            readonly={isSharedWithMe || isAppPublic}
            error={errors.documentRelativeUrl?.message}
            fileManagerTitle={t('Select documents')}
            files={field.value ?? []}
            addBtnTooltip={
              isSharedWithMe ? getSharedTooltip(t('documents')) : undefined
            }
            confirmDialogValues={
              appDetails?.isShared ? CONFIRM_DOCUMENT_VALUES : undefined
            }
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
          />
        )}
      />

      <Controller
        name="model"
        control={control}
        render={({ field }) => (
          <ModelsSelectorField
            label={t('Model')}
            value={field.value}
            onChange={field.onChange}
            mandatory
            error={errors.model?.message}
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
          />
        )}
      />

      <Controller
        name="agentsAndToolsets"
        control={control}
        render={({ field }) => {
          const handleRemoveFromDetails = (
            entityToRemove: MarketplaceEntity,
          ) => {
            const currentIds = field.value || [];
            const newIds = currentIds.filter((id) => id !== entityToRemove.id);
            field.onChange(newIds);
            handleCloseDetails();
          };

          return (
            <>
              <AgentAndToolsetSelectorField
                value={field.value}
                onChange={field.onChange}
                allItemsMap={allEntitiesMap}
                label={t('Agents & Toolsets')}
                readonly={isAppPublic}
                tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
                onItemClick={handleItemClick}
              />
              {detailedViewEntity &&
                isApplicationOrModel(detailedViewEntity) && (
                  <ApplicationDetails
                    entity={detailedViewEntity}
                    allEntities={allModels}
                    onClose={handleCloseDetails}
                    onChangeVersion={handleChangeVersionInDetails}
                    FooterComponent={SimpleApplicationDetailsFooter}
                    onRemove={handleRemoveFromDetails}
                    isPreview
                  />
                )}

              {detailedViewEntity && isToolset(detailedViewEntity) && (
                <ToolsetDetails
                  entity={detailedViewEntity}
                  allEntities={allToolsets}
                  onClose={handleCloseDetails}
                  onChangeVersion={handleChangeVersionInDetails}
                  FooterComponent={SimpleToolsetDetailsFooter}
                  onRemove={handleRemoveFromDetails}
                  isPreview
                />
              )}
            </>
          );
        }}
      />

      <FieldTextArea
        {...register('instructions')}
        label={t('Instructions')}
        placeholder={t('Instructions of your application')}
        rows={4}
        className="resize-none"
        id="instructions"
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <Controller
        name="codeInterpreter"
        control={control}
        render={({ field }) => (
          <ToggleSwitchField
            label={t('Code Interpreter')}
            isOn={field.value}
            handleSwitch={field.onChange}
            switchOnText={t('ON')}
            switchOFFText={t('OFF')}
            className="flex w-fit"
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
          />
        )}
      />

      <Controller
        name="temperature"
        control={control}
        render={({ field }) => (
          <Slider
            label={t('Temperature')}
            temperature={field.value}
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
            onChangeTemperature={field.onChange}
          />
        )}
      />
    </div>
  );
};
