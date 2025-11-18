import { useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  SettingsSelectors,
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

import { Feature } from '@epam/ai-dial-shared';
import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));
const AgentAndToolsetSelectorField = withErrorMessage(
  withLabel(AgentAndToolsetSelector),
);
const ToggleSwitchField = withLabel(ToggleSwitch);

export const QuickApp2Form = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);

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

  const { control, formState, register } = useFormContext<QuickApp2FormType>();
  const errors = formState.errors;

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

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
        render={({ field }) => (
          <AgentAndToolsetSelectorField
            value={field.value}
            onChange={field.onChange}
            allItemsMap={allEntitiesMap}
            label={t('Agents & Toolsets')}
            readonly={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
          />
        )}
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

      {isCodeInterpreterEnabled && (
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
      )}

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
