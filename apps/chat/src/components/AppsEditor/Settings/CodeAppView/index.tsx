import { useCallback, useEffect, useRef } from 'react';
import {
  Controller,
  Path,
  RegisterOptions,
  useFormContext,
} from 'react-hook-form';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { castToString } from '@/src/utils/app/common';

import {
  ApplicationStatus,
  CustomApplicationModel,
} from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { CodeEditorActions } from '@/src/store/codeEditor/codeEditor.reducer';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ShareActions } from '@/src/store/share/share.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import {
  CODEAPPS_REQUIRED_FILES,
  CONFIRM_SOURCE_FOLDER_VALUES,
} from '@/src/constants/applications';
import { CODE_APPS_ENDPOINTS } from '@/src/constants/code-apps';
import { MIME_FORMAT_REGEX } from '@/src/constants/file';

import { FormCodeEditor } from '@/src/components/Common/ApplicationWizard/CodeAppView/FormCodeEditor';
import { RuntimeVersionSelector } from '@/src/components/Common/ApplicationWizard/CodeAppView/RuntimeVersionSelector';
import { SourceFilesEditor } from '@/src/components/Common/ApplicationWizard/CodeAppView/SourceFilesEditor';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { DynamicFormFields } from '@/src/components/Common/Forms/DynamicFormFields';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withWarningMessage } from '@/src/components/Common/Forms/FieldWarningMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';

import {
  CodeAppFormData,
  endpointsKeyValidator,
  endpointsValueValidator,
  envKeysValidator,
  envValueValidator,
  getAttachmentTypeErrorHandlers,
  getCodeAppData,
} from '../form';

import isEqual from 'lodash-es/isEqual';

type Options<T extends Path<CodeAppFormData>> = Omit<
  RegisterOptions<CodeAppFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof CodeAppFormData]?: Options<K>;
};

const validators: Validators = {
  inputAttachmentTypes: {
    validate: (types) =>
      types.every((v) => MIME_FORMAT_REGEX.test(v)) ||
      'Please match the MIME format',
  },
  maxInputAttachments: {
    validate: (v?: number | '') => {
      if (v === '' || v === undefined) return true;
      const reg = /^[0-9]+$/;
      return reg.test(String(v)) || 'Max attachments must be a number';
    },
    setValueAs: (v: string): number | '' =>
      v === '' ? '' : Number(v.replace(/[^0-9]/g, '')),
  },
  sources: {
    required: 'Source folder is required',
  },
  sourceFiles: {
    validate: (files: string[] | undefined) => {
      if (!files?.includes(CODEAPPS_REQUIRED_FILES.APP)) {
        return `This folder does not contain the required "${CODEAPPS_REQUIRED_FILES.APP}" file`;
      }
      if (!files.includes(CODEAPPS_REQUIRED_FILES.REQUIREMENTS)) {
        return `This folder does not contain the required "${CODEAPPS_REQUIRED_FILES.REQUIREMENTS}" file`;
      }
      return true;
    },
  },
};

const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);
const FilesEditor = withController(
  withWarningMessage(withLabel(SourceFilesEditor)),
);
const RuntimeSelector = withController(withLabel(RuntimeVersionSelector));
const MappingsForm = withLabel(
  DynamicFormFields<CodeAppFormData, 'endpoints' | 'env'>,
);

interface CodeAppViewProps {
  isSharedWithMe: boolean;
  oldApplication: CustomApplicationModel;
  isShared: boolean;
  applicationStatus?: ApplicationStatus;
}

export const CodeAppView: React.FC<CodeAppViewProps> = ({
  isSharedWithMe,
  oldApplication,
  isShared,
  applicationStatus,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const {
    control,
    handleSubmit: submitWrapper,
    setError,
    clearErrors,
    formState: { errors, defaultValues, isValid },
    watch,
    register,
  } = useFormContext<CodeAppFormData>();

  const lastSubmittedValuesRef = useRef<CodeAppFormData | undefined>(
    defaultValues as CodeAppFormData,
  );

  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );

  const exitAfterSave = useAppSelector(
    ApplicationSelectors.selectExitAfterSave,
  );

  const confirmSourceFolderValues = oldApplication?.isShared
    ? CONFIRM_SOURCE_FOLDER_VALUES
    : undefined;

  const router = useRouter();

  const handleEdit = useCallback(
    (data: CodeAppFormData) => {
      if (
        oldApplication.reference &&
        shouldSaveApplication &&
        !isEqual(data, lastSubmittedValuesRef.current)
      ) {
        const preparedData = getCodeAppData(data);

        preparedData.functionStatus = applicationStatus;
        const applicationData: CustomApplicationModel = {
          ...oldApplication,
          ...preparedData,
        };

        if (
          isShared &&
          preparedData.function?.sourceFolder !==
            oldApplication.function?.sourceFolder
        ) {
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
            applicationData,
          }),
        );
        lastSubmittedValuesRef.current = data;
      } else {
        dispatch(ApplicationActions.setShouldSaveApplication(false));
        dispatch(ApplicationActions.setExitAfterSave(false));
      }
    },
    [
      oldApplication,
      dispatch,
      isShared,
      shouldSaveApplication,
      applicationStatus,
    ],
  );

  register('sourceFiles', validators['sourceFiles']);
  const sources = watch('sources');

  useEffect(() => {
    return () => {
      dispatch(CodeEditorActions.resetCodeEditor());
    };
  }, [dispatch]);

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
      submitWrapper(handleEdit)();
    }
  }, [
    exitAfterSave,
    router,
    submitWrapper,
    shouldSaveApplication,
    handleEdit,
    isValid,
    dispatch,
    t,
  ]);

  return (
    <form
      onSubmit={submitWrapper(handleEdit)}
      className="flex size-full flex-col bg-layer-2"
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto p-5">
        <Controller
          name="inputAttachmentTypes"
          rules={validators['inputAttachmentTypes']}
          control={control}
          render={({ field }) => (
            <ComboBoxField
              label={t('Attachment types')}
              info={t("Input the MIME type and press 'Enter' to add")}
              initialSelectedItems={field.value}
              getItemLabel={castToString}
              getItemValue={castToString}
              onChangeSelectedItems={field.onChange}
              placeholder={t('Enter one or more attachment types')}
              className="input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full"
              hasDeleteAll
              hideSuggestions
              itemHeightClassName="h-[31px]"
              error={errors.inputAttachmentTypes?.message}
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
          rules={validators['maxInputAttachments']}
        />

        <FilesEditor
          mandatory
          control={control}
          name="sources"
          label={t('Select folder with source files')}
          rules={validators['sources']}
          error={errors.sources?.message || errors.sourceFiles?.message}
          disabled={isSharedWithMe}
          tooltip={
            isSharedWithMe ? getSharedTooltip('folder with source files') : ''
          }
          warning={confirmSourceFolderValues?.description}
          confirmDialogValues={confirmSourceFolderValues}
        />

        {sources && <FormCodeEditor sourcesFolderId={sources} />}

        <RuntimeSelector
          control={control}
          name="runtime"
          label={t('Runtime version')}
        />

        <MappingsForm
          label={t('Endpoints')}
          addLabel={t('Add endpoint')}
          valueLabel={t('Endpoint')}
          options={CODE_APPS_ENDPOINTS}
          name="endpoints"
          keyOptions={endpointsKeyValidator}
          valueOptions={endpointsValueValidator}
          errors={errors.endpoints}
        />

        <MappingsForm
          creatable
          label={t('Environment variables')}
          addLabel={t('Add variable')}
          name="env"
          keyOptions={envKeysValidator}
          valueOptions={envValueValidator}
          errors={errors.env}
        />
      </div>
    </form>
  );
};
