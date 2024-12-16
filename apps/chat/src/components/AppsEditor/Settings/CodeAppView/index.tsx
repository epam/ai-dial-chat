import {
  Controller,
  Path,
  RegisterOptions,
  useFormContext,
} from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { CODEAPPS_REQUIRED_FILES } from '@/src/constants/applications';
import { CODE_APPS_ENDPOINTS } from '@/src/constants/code-apps';
import { MIME_FORMAT_REGEX } from '@/src/constants/file';

import { CodeEditor } from '@/src/components/Common/ApplicationWizard/CodeAppView/CodeEditor';
import { RuntimeVersionSelector } from '@/src/components/Common/ApplicationWizard/CodeAppView/RuntimeVersionSelector';
import { SourceFilesEditor } from '@/src/components/Common/ApplicationWizard/CodeAppView/SourceFilesEditor';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { DynamicFormFields } from '@/src/components/Common/Forms/DynamicFormFields';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';

import { ApplicationSettingsFormFooter } from '../ApplicationSettingsFormFooter';
import {
  CodeAppFormData,
  endpointsKeyValidator,
  endpointsValueValidator,
  envKeysValidator,
  envValueValidator,
  getAttachmentTypeErrorHandlers,
  getCodeAppData,
} from '../form';

type Options<T extends Path<CodeAppFormData>> = Omit<
  RegisterOptions<CodeAppFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof CodeAppFormData]?: Options<K>;
};

export const validators: Validators = {
  inputAttachmentTypes: {
    validate: (types) => {
      return (
        types.every((v) => MIME_FORMAT_REGEX.test(v)) ||
        'Please match the MIME format'
      );
    },
  },
  maxInputAttachments: {
    validate: (v) => {
      const reg = /^[0-9]*$/;

      return reg.test(String(v)) || 'Max attachments must be a number';
    },
    setValueAs: (v) => {
      return v.replace(/[^0-9]/g, '');
    },
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
const FilesEditor = withController(withLabel(SourceFilesEditor));
const RuntimeSelector = withController(withLabel(RuntimeVersionSelector));
const MappingsForm = withLabel(
  DynamicFormFields<CodeAppFormData, 'endpoints' | 'env'>,
);

export const CodeAppView: React.FC = () => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const {
    control,
    handleSubmit: submitWrapper,
    setError,
    clearErrors,
    formState: { errors, isValid },
    watch,
  } = useFormContext<CodeAppFormData>();

  const handleSubmit = (data: CodeAppFormData) => {
    const applicationData = getCodeAppData(data);
    dispatch(
      ApplicationActions.update({
        oldApplicationId: data.id,
        applicationData: {
          ...applicationData,
          id: data.id,
          reference: data.reference,
        },
      }),
    );
  };

  const sources = watch('sources');

  return (
    <form
      onSubmit={submitWrapper(handleSubmit)}
      className="flex size-full flex-col bg-layer-2"
    >
      <div className="grow space-y-4 divide-tertiary overflow-y-auto p-5">
        <Controller
          name="inputAttachmentTypes"
          rules={validators['inputAttachmentTypes']}
          control={control}
          render={({ field }) => (
            <ComboBoxField
              label={t('Attachment types') || ''}
              info={t("Input the MIME type and press 'Enter' to add")}
              initialSelectedItems={field.value}
              getItemLabel={(i: unknown) => i as string}
              getItemValue={(i: unknown) => i as string}
              onChangeSelectedItems={field.onChange}
              placeholder={t('Enter one or more attachment types') || ''}
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
          placeholder={t('Enter the maximum number of attachments') || ''}
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
        />
        {sources && <CodeEditor sourcesFolderId={sources} />}
        <RuntimeSelector
          control={control}
          name="runtime"
          label={t('Runtime version')}
        />
        <MappingsForm
          label={t('Endpoints')}
          addLabel={t('Add endpoint') ?? ''}
          valueLabel={t('Endpoint') ?? ''}
          options={CODE_APPS_ENDPOINTS}
          name="endpoints"
          keyOptions={endpointsKeyValidator}
          valueOptions={endpointsValueValidator}
          errors={errors.endpoints}
        />
        <MappingsForm
          creatable
          label={t('Environment variables')}
          addLabel={t('Add variable') ?? ''}
          name="env"
          keyOptions={envKeysValidator}
          valueOptions={envValueValidator}
          errors={errors.env}
        />
      </div>
      <div className="sticky">
        <ApplicationSettingsFormFooter isValid={isValid} />
      </div>
    </form>
  );
};
