import {
  Controller,
  Path,
  RegisterOptions,
  useFormContext,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import {
  CODEAPPS_REQUIRED_FILES,
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
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

const features = [
  {
    label: FEATURES_ENDPOINTS_NAMES[FEATURES_ENDPOINTS.chat_completion],
    value: FEATURES_ENDPOINTS.chat_completion,
    defaultValue:
      FEATURES_ENDPOINTS_DEFAULT_VALUES[FEATURES_ENDPOINTS.chat_completion],
  },
  {
    label: FEATURES_ENDPOINTS_NAMES[FEATURES_ENDPOINTS.rate],
    value: FEATURES_ENDPOINTS.rate,
    defaultValue: FEATURES_ENDPOINTS_DEFAULT_VALUES[FEATURES_ENDPOINTS.rate],
  },
  {
    label: FEATURES_ENDPOINTS_NAMES[FEATURES_ENDPOINTS.configuration],
    value: FEATURES_ENDPOINTS.configuration,
    defaultValue:
      FEATURES_ENDPOINTS_DEFAULT_VALUES[FEATURES_ENDPOINTS.configuration],
  },
];

type Options<T extends Path<CodeAppFormData>> = Omit<
  RegisterOptions<CodeAppFormData, T>,
  'disabled' | 'valueAsNumber' | 'valueAsDate'
>;

type Validators = {
  [K in keyof CodeAppFormData]?: Options<K>;
};

export const validators: Validators = {
  // features: {
  //   validate: (data) => {
  //     if (!data?.trim()) return true;

  //     try {
  //       const object = JSON.parse(data);

  //       if (typeof object === 'object' && !!object && !Array.isArray(object)) {
  //         for (const [key, value] of Object.entries(object)) {
  //           if (!key.trim()) {
  //             return 'Keys should not be empty';
  //           }

  //           const valueType = typeof value;
  //           if (
  //             !(['boolean', 'number'].includes(valueType) || value === null)
  //           ) {
  //             if (typeof value === 'string' && !value.trim()) {
  //               return 'String values should not be empty';
  //             }

  //             if (!['boolean', 'number', 'string'].includes(valueType)) {
  //               return 'Values should be a string, number, boolean or null';
  //             }
  //           }
  //         }
  //       } else {
  //         return 'Data is not a valid JSON object';
  //       }

  //       return true;
  //     } catch (error) {
  //       return 'Invalid JSON string';
  //     }
  //   },
  // },
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
    register,
    control,
    handleSubmit: submitWrapper,
    setError,
    clearErrors,
    formState: { errors, isValid },
    watch,
    setValue,
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
    <div className="size-full max-w-[1000px] overflow-hidden bg-layer-2">
      <form
        onSubmit={submitWrapper(handleSubmit)}
        className="flex size-full flex-col"
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
          {sources && (
            <CodeEditor sourcesFolderId={sources} setValue={setValue} />
          )}
          <RuntimeSelector
            control={control}
            name="runtime"
            label={t('Runtime version')}
          />
          <MappingsForm
            label={t('Endpoints')}
            addLabel={t('Add endpoint') ?? ''}
            valueLabel={t('Endpoint') ?? ''}
            options={features}
            register={register}
            control={control}
            name="endpoints"
            keyOptions={endpointsKeyValidator}
            valueOptions={endpointsValueValidator}
            errors={errors.endpoints}
          />
          <MappingsForm
            creatable
            label={t('Environment variables')}
            addLabel={t('Add variable') ?? ''}
            register={register}
            control={control}
            name="env"
            keyOptions={envKeysValidator}
            valueOptions={envValueValidator}
            errors={errors.env}
          />
        </div>
        <ApplicationSettingsFormFooter isValid={isValid} />
      </form>
    </div>
  );
};
