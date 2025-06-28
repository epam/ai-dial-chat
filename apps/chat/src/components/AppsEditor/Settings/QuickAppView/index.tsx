import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Controller,
  Path,
  RegisterOptions,
  useController,
  useFormContext,
} from 'react-hook-form';

import { useRouter } from 'next/router';

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
import { CustomApplicationModel, Toolsets } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ShareActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors, ModelsSelectors } from '@/src/store/selectors';

import { CONFIRM_DOCUMENT_VALUES } from '@/src/constants/applications';
import { PUBLIC_APP_TOOLTIP } from '@/src/constants/code-apps';

import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { FilesSelector } from '@/src/components/Common/FilesSelector/FilesSelector';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';

import { QuickAppFormData, getQuickAppData } from '../form';

import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';

type Options<T extends Path<QuickAppFormData>> = Omit<
  RegisterOptions<QuickAppFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof QuickAppFormData]?: Options<K>;
};

const validators: Validators = {
  [Toolsets.WebApiToolset]: {
    required: 'Toolset config is required',
    validate: (v) => {
      try {
        JSON.parse(v);
      } catch {
        return 'Config is not a valid JSON object';
      }
      return true;
    },
  },

  [Toolsets.McpToolset]: {
    validate: (v) => {
      try {
        JSON.parse(v ?? '');
      } catch {
        return 'Config is not a valid JSON object';
      }
      return true;
    },
  },
};

const FilesSelectorField = withErrorMessage(withLabel(FilesSelector));
const ToolsetEditor = withErrorMessage(withLabel(MonacoEditor));
const Slider = withLabel(TemperatureSlider, true);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));

const myFilesFilter = new Set([FileSourceType.MY_FILES]);

interface QuickAppViewProps {
  schema: ApiDetailedApplicationTypeSchema | null;
  isSharedWithMe: boolean;
  oldApplication: CustomApplicationModel;
  isShared?: boolean;
  publicationUrl?: string;
}

export const QuickAppView: React.FC<QuickAppViewProps> = ({
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
    watch,
  } = useFormContext<QuickAppFormData>();

  const lastSubmittedValuesRef = useRef<QuickAppFormData | undefined>(
    defaultValues as QuickAppFormData,
  );

  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );
  const exitAfterSave = useAppSelector(
    ApplicationSelectors.selectExitAfterSave,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const isAppPublic = isEntityIdPublic(oldApplication);
  const confirmDocumentUrlValues = oldApplication?.isShared
    ? CONFIRM_DOCUMENT_VALUES
    : undefined;

  const router = useRouter();

  const handleSubmit = useCallback(
    (data: QuickAppFormData) => {
      const hasChanged = !isEqual(data, lastSubmittedValuesRef.current);
      if (hasChanged) {
        const applicationData = getQuickAppData(data, modelsMap);

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
    router,
    t,
  ]);

  const editorOptions = useMemo(
    () => ({
      readOnly: isAppPublic,
    }),
    [isAppPublic],
  );

  const editorTabs = useMemo(() => {
    return [
      {
        id: Toolsets.WebApiToolset,
        label: 'Web API',
        value: watch(Toolsets.WebApiToolset) ?? '',
        language: 'json',
      },
      {
        id: Toolsets.McpToolset,
        label: 'MCP',
        value: watch(Toolsets.McpToolset) ?? '',
        language: 'json',
      },
    ];
  }, [watch]);

  const [activeTabId, setActiveTabId] = useState(Toolsets.WebApiToolset);

  const toolsetController = useController({
    name: Toolsets.WebApiToolset,
    control,
    rules: validators[Toolsets.WebApiToolset],
  });
  const mcpToolsetController = useController({
    name: Toolsets.McpToolset,
    control,
    rules: validators[Toolsets.McpToolset],
  });

  const fieldControllers = useMemo(
    () => ({
      [Toolsets.WebApiToolset]: toolsetController,
      [Toolsets.McpToolset]: mcpToolsetController,
    }),
    [toolsetController, mcpToolsetController],
  );

  const handleFileChange = useCallback(
    (fileId: Toolsets, value: string) => {
      const controller = fieldControllers[fileId]?.field;
      if (controller) {
        controller.onChange(value);
        controller.onBlur();
      }
    },
    [fieldControllers],
  );

  const handleTabChange = (id: string) => {
    setActiveTabId(id as Toolsets);
  };

  const handleFileChangeWrapper = (fileId: string, value: string) => {
    handleFileChange(fileId as Toolsets, value);
  };

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

        <ToolsetEditor
          label={t('Configure toolsets')}
          error={errors[activeTabId]?.message}
          height={200}
          allowFullScreen
          files={editorTabs}
          onTabChange={handleTabChange}
          activeFileId={activeTabId}
          onChangeFile={handleFileChangeWrapper}
          options={editorOptions}
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
