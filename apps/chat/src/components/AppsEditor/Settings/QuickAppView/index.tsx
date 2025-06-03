import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Controller,
  Path,
  RegisterOptions,
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
import { ApplicationSelectors } from '@/src/store/selectors';

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
  toolset: {
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
}

export const QuickAppView: React.FC<QuickAppViewProps> = ({
  schema,
  isSharedWithMe,
  oldApplication,
  isShared,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const {
    register,
    control,
    handleSubmit: submitWrapper,
    formState: { errors, defaultValues, isValid },
    getFieldState,
    getValues,
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

  const confirmDocumentUrlValues = oldApplication?.isShared
    ? CONFIRM_DOCUMENT_VALUES
    : undefined;

  const router = useRouter();

  const handleSubmit = useCallback(
    (data: QuickAppFormData) => {
      const hasChanged = !isEqual(data, lastSubmittedValuesRef.current);

      if (hasChanged) {
        const applicationData = getQuickAppData(data);

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
    [exitAfterSave, dispatch, isShared, oldApplication, schema],
  );

  const autoSaveHandler = useCallback(() => {
    submitWrapper(handleSubmit)();
  }, [submitWrapper, handleSubmit]);

  const savePartialForm = useCallback(() => {
    const data = getValues();
    if (!isValid && lastSubmittedValuesRef.current) {
      handleSubmit({
        ...lastSubmittedValuesRef.current,
        ...getValidFormFields(data, getFieldState),
      });
    } else if (isValid) {
      handleSubmit(data);
    }
  }, [getFieldState, getValues, handleSubmit, isValid]);

  useBeforeRedirect(savePartialForm);

  useEffect(() => {
    const isTriggered = shouldSaveApplication || exitAfterSave;
    if (!isTriggered) return;

    if (!isValid) {
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
    isValid,
    shouldSaveApplication,
    router,
    t,
  ]);

  const isAppPublic = isEntityIdPublic(oldApplication);
  const editorOptions = useMemo(
    () => ({
      readOnly: isAppPublic,
    }),
    [isAppPublic],
  );

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
              onAddFiles={(documents) => {
                field.onChange(
                  uniq([...(field.value ? field.value : []), ...documents]),
                );
              }}
              onRemoveFile={(document) => {
                field.onChange(
                  field.value?.filter((field) => field !== document),
                );
              }}
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
          name="toolset"
          control={control}
          rules={validators['toolset']}
          render={({ field }) => (
            <ToolsetEditor
              label={t('Configure toolset')}
              error={errors.toolset?.message}
              height={200}
              value={field.value}
              className="m-0.5 w-full overflow-hidden rounded border border-primary"
              language="json"
              onChange={(v) => field.onChange(v ?? '')}
              allowFullScreen
              options={editorOptions}
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
