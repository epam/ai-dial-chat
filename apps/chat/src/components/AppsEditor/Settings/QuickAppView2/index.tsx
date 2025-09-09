import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useBeforeRedirect } from '@/src/hooks/useBeforeRedirect';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getQuickAppDocumentUrl,
  getSharedTooltip,
} from '@/src/utils/app/application';
import { arraysHaveSameElements } from '@/src/utils/app/common';
import { getValidFormFields } from '@/src/utils/app/forms';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { ApiDetailedApplicationTypeSchema } from '@/src/types/application-type-schema';
import { CustomApplicationModel } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { CONFIRM_DOCUMENT_VALUES } from '@/src/constants/applications';
import { PUBLIC_APP_TOOLTIP } from '@/src/constants/code-apps';

import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { AgentAndToolsetSelector } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetSelector';
import { FilesSelector } from '@/src/components/Common/FilesSelector/FilesSelector';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';

import { QuickAppFormData2, getQuickAppData2 } from '../form';

import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const AgentAndToolsetSelectorField = withErrorMessage(
  withLabel(AgentAndToolsetSelector),
);
const Slider = withLabel(TemperatureSlider, true);
const ToggleSwitchField = withLabel(ToggleSwitch);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));

const myFilesFilter = new Set([FileSourceType.MY_FILES]);

interface QuickAppView2Props {
  schema: ApiDetailedApplicationTypeSchema | null;
  isSharedWithMe: boolean;
  oldApplication: CustomApplicationModel;
  isShared?: boolean;
  publicationUrl?: string;
}

export const QuickAppView2: React.FC<QuickAppView2Props> = ({
  schema,
  isSharedWithMe,
  oldApplication,
  isShared,
  publicationUrl,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, defaultValues, isValid: isFormValid },
    getFieldState,
    getValues,
  } = useFormContext<QuickAppFormData2>();

  const lastSubmittedValuesRef = useRef<QuickAppFormData2 | undefined>(
    defaultValues as QuickAppFormData2,
  );

  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );
  const exitAfterSave = useAppSelector(
    ApplicationSelectors.selectExitAfterSave,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);

  const allEntitiesMap = useMemo(
    () => ({
      ...modelsMap,
      ...toolsetsMap,
    }),
    [modelsMap, toolsetsMap],
  );

  const isAppPublic = isEntityIdPublic(oldApplication);
  const confirmDocumentUrlValues = oldApplication?.isShared
    ? CONFIRM_DOCUMENT_VALUES
    : undefined;

  const handleSubmit = useCallback(
    (data: QuickAppFormData2) => {
      const hasChanged = !isEqual(data, lastSubmittedValuesRef.current);
      if (hasChanged) {
        const applicationData = getQuickAppData2(
          data,
          modelsMap,
          allEntitiesMap,
        );

        const arrAreNotTheSameAndShared =
          isShared &&
          !arraysHaveSameElements(
            getQuickAppDocumentUrl(applicationData as CustomApplicationModel),
            getQuickAppDocumentUrl(oldApplication),
          );

        if (arrAreNotTheSameAndShared) {
          dispatch(
            ShareActions.revokeAccess({
              resourceId: oldApplication.id,
              featureType: FeatureType.Application,
            }),
          );
        }
        dispatch(
          ApplicationActions.update({
            oldApplication,
            applicationData: {
              ...oldApplication,
              ...applicationData,
              isShared: arrAreNotTheSameAndShared ? false : isShared,
            },
            schema: schema ?? undefined,
            publicationUrl,
          }),
        );
        lastSubmittedValuesRef.current = data;
      }
      if (exitAfterSave) {
        dispatch(ApplicationActions.exitEditor({}));
      }
      dispatch(ApplicationActions.setShouldSaveApplication(false));
      dispatch(ApplicationActions.setExitAfterSave(false));
    },
    [
      exitAfterSave,
      dispatch,
      modelsMap,
      allEntitiesMap,
      isShared,
      oldApplication,
      schema,
      publicationUrl,
    ],
  );

  const autoSaveHandler = useCallback(() => {
    submitWrapper(handleSubmit)();
  }, [submitWrapper, handleSubmit]);

  const savePartialForm = useCallback(() => {
    if (isAppPublic) return;
    const data = getValues();
    if (!isFormValid && lastSubmittedValuesRef.current) {
      handleSubmit({
        ...lastSubmittedValuesRef.current,
        ...getValidFormFields(data, getFieldState),
      });
    } else if (isFormValid) {
      handleSubmit(data);
    }
  }, [getFieldState, getValues, handleSubmit, isFormValid, isAppPublic]);

  useBeforeRedirect(savePartialForm);

  useEffect(() => {
    const isTriggered = shouldSaveApplication || exitAfterSave;
    if (!isTriggered) return;
    if (!isFormValid) {
      dispatch(ApplicationActions.setShouldSaveApplication(false));
      dispatch(ApplicationActions.setExitAfterSave(false));
      dispatch(
        UIActions.showErrorToast(t('Please fill in all mandatory fields')),
      );
      return;
    }
    if (shouldSaveApplication) {
      autoSaveHandler();
    }
  }, [
    autoSaveHandler,
    dispatch,
    exitAfterSave,
    isFormValid,
    shouldSaveApplication,
    t,
  ]);

  return (
    <form
      onSubmit={submitWrapper(handleSubmit)}
      className="flex size-full flex-col bg-layer-2"
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto px-3 py-4 md:px-5 xl:py-5">
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
                field.onChange(
                  field.value?.filter((field) => field !== document),
                )
              }
              readonly={isSharedWithMe || isAppPublic}
              error={errors.documentRelativeUrl?.message}
              fileManagerTitle={t('Select documents')}
              filesFilter={myFilesFilter}
              files={field.value ?? []}
              addBtnTooltip={
                isSharedWithMe ? getSharedTooltip(t('documents')) : undefined
              }
              confirmDialogValues={confirmDocumentUrlValues}
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
    </form>
  );
};
