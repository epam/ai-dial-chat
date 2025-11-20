import { useCallback, useMemo, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getSharedTooltip,
  isDialAiEntityModel,
} from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  SettingsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import {
  CONFIRM_DOCUMENT_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';

import {
  QuickApp2Form as QuickApp2FormType,
  getAttachmentTypeErrorHandlers,
} from '@/src/components/AppsEditor/form';
import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { AgentAndToolsetSelector } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetSelector';
import { FilesSelector } from '@/src/components/Common/FilesSelector/FilesSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';
import { ApplicationDetails } from '@/src/components/Marketplace/ApplicationDetails/ApplicationDetails';
import { SimpleApplicationDetailsFooter } from '@/src/components/Marketplace/ApplicationDetails/SimpleApplicationDetailsFooter';
import { SimpleToolsetDetailsFooter } from '@/src/components/Marketplace/ToolsetsDetails/SimpleToolsetDetailsFooter';
import { ToolsetDetails } from '@/src/components/Marketplace/ToolsetsDetails/ToolsetDetails';

import { Feature } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));
const AgentAndToolsetSelectorField = withErrorMessage(
  withLabel(AgentAndToolsetSelector),
);
const ToggleSwitchField = withLabel(ToggleSwitch);
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);

const getItemLabel = (item: unknown): string => item as string;

export const QuickApp2Form = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);

  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
  const modelTypeAgents = useAppSelector(ModelsSelectors.selectModelTypeAgents);

  const toolSupportingModels = useMemo(
    () => modelTypeAgents.filter((model) => model.features?.tools),
    [modelTypeAgents],
  );

  const isCodeInterpreterEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeInterpreter),
  );

  const allEntitiesMap = useMemo(
    () => ({
      ...modelsMap,
      ...toolsetsMap,
    }),
    [modelsMap, toolsetsMap],
  );

  const {
    control,
    formState,
    register,
    setError,
    clearErrors,
    getValues,
    setValue,
  } = useFormContext<QuickApp2FormType>();
  const errors = formState.errors;

  const modelId = useWatch({
    control,
    name: 'model',
  });

  const showTemperatureSlider = useMemo(() => {
    const selectedModel = modelsMap[modelId];
    return selectedModel?.features?.temperature !== false;
  }, [modelId, modelsMap]);

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

  const handleRemoveFromDetails = useCallback(
    (entityToRemove: MarketplaceEntity) => {
      const currentValue = getValues('agentsAndToolsets') || [];
      setValue(
        'agentsAndToolsets',
        currentValue.filter((id) => id !== entityToRemove.id),
        { shouldTouch: true, shouldDirty: true },
      );
      handleCloseDetails();
    },
    [getValues, setValue, handleCloseDetails],
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
    <div
      className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5"
      data-qa="entity-view-form"
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
            models={toolSupportingModels}
          />
        )}
      />

      <Controller
        name="agentsAndToolsets"
        control={control}
        render={({ field }) => {
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
        name="inputAttachmentTypes"
        control={control}
        render={({ field }) => (
          <ComboBoxField
            label={t('Attachment types')}
            info={t("Input the MIME type and press 'Enter' to add")}
            initialSelectedItems={field.value}
            getItemLabel={getItemLabel}
            getItemValue={getItemLabel}
            onChangeSelectedItems={field.onChange}
            placeholder={t('Enter one or more attachment types')}
            id="attachmentTypes"
            className={classNames(
              'input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full',
              isAppPublic && 'hover:border-primary',
            )}
            hasDeleteAll
            hideSuggestions
            itemHeightClassName="h-[31px]"
            error={errors.inputAttachmentTypes?.message}
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
            dataQa={'attachment-types-field'}
            {...getAttachmentTypeErrorHandlers(setError, clearErrors)}
          />
        )}
      />

      <ControlledField
        label={t('Max. attachments number')}
        placeholder={t('Enter the maximum number of attachments')}
        id="maxInputAttachments"
        error={errors.maxInputAttachments?.message}
        control={control}
        name="maxInputAttachments"
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
        dataQa={'max-attachment-number-field'}
      />

      {isCodeInterpreterEnabled && (
        <Controller
          name="codeInterpreter"
          control={control}
          render={({ field }) => (
            <ToggleSwitchField
              label={t('Code Interpreter')}
              info={t(
                'Allows to build multi-agent applications where agents can generate and safely execute Python code in real-time to perform specific tasks, such as data visualization or analytics.',
              )}
              isOn={field.value}
              handleSwitch={field.onChange}
              switchOnText={t('ON')}
              switchOFFText={t('OFF')}
              additionalText={t('Use to execute custom Python code')}
              className="mt-1 flex w-fit items-center gap-2"
              disabled={isAppPublic}
              tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
            />
          )}
        />
      )}

      {showTemperatureSlider && (
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
      )}
    </div>
  );
};
