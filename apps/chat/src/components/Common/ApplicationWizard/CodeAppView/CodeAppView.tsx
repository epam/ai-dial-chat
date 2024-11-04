import React, { useCallback, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { topicToOption } from '@/src/utils/app/application';

import {
  ApplicationType,
  CustomApplicationModel,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import {
  FEATURES_ENDPOINTS,
  FEATURES_ENDPOINTS_DEFAULT_VALUES,
  FEATURES_ENDPOINTS_NAMES,
} from '@/src/constants/applications';
import { IMAGE_TYPES } from '@/src/constants/chat';
import { DEFAULT_VERSION } from '@/src/constants/public';

import { ApplicationWizardFooter } from '@/src/components/Common/ApplicationWizard/ApplicationWizardFooter';
import { SourceFilesEditor } from '@/src/components/Common/ApplicationWizard/CodeAppView/SourceFilesEditor';
import {
  FormData,
  endpointsKeyValidator,
  endpointsValueValidator,
  envKeysValidator,
  envValueValidator,
  getApplicationData,
  getAttachmentTypeErrorHandlers,
  getDefaultValues,
  validators,
} from '@/src/components/Common/ApplicationWizard/form';
import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { DynamicFormFields } from '@/src/components/Common/Forms/DynamicFormFields';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { ViewProps } from '../view-props';
import { CodeEditor } from './CodeEditor';

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

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);
const ControlledField = withController(Field);
const FilesEditor = withController(withLabel(SourceFilesEditor));
const MappingsForm = withLabel(
  DynamicFormFields<FormData, 'endpoints' | 'env'>,
);
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));

export const CodeAppView: React.FC<ViewProps> = ({
  onClose,
  isEdit,
  type,
  selectedApplication,
  currentReference,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const topics = useAppSelector(SettingsSelectors.selectTopics);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const pythonVersions = useAppSelector(
    SettingsSelectors.selectCodeEditorPythonVersions,
  );

  const modelsWithFolderId = models.map((model) => ({
    ...model,
    folderId: '',
  }));

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

  const {
    register,
    control,
    formState: { errors, isValid },
    setError,
    clearErrors,
    handleSubmit: submitWrapper,
    setValue,
    watch,
  } = useForm<FormData>({
    defaultValues: getDefaultValues({
      app: selectedApplication,
      models: modelsWithFolderId,
      runtime: pythonVersions[0],
    }),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const handleSubmit = (data: FormData) => {
    const preparedData = getApplicationData(data, type);

    if (type === ApplicationType.CODE_APP) {
      preparedData.functionStatus = selectedApplication?.functionStatus;
    }

    if (
      isEdit &&
      selectedApplication?.name &&
      currentReference &&
      selectedApplication.id
    ) {
      const applicationData: CustomApplicationModel = {
        ...preparedData,
        reference: currentReference,
        id: selectedApplication.id,
      };

      dispatch(
        ApplicationActions.update({
          oldApplicationId: selectedApplication.id,
          applicationData,
        }),
      );
    } else {
      dispatch(ApplicationActions.create(preparedData));
    }

    onClose(true);
  };

  register('sourceFiles', validators['sourceFiles']);
  const sources = watch('sources');

  return (
    <form
      onSubmit={submitWrapper(handleSubmit)}
      className="relative flex max-h-full w-full grow flex-col divide-tertiary overflow-y-auto"
    >
      <div className="flex flex-col gap-4 overflow-y-auto px-3 pb-6 md:px-6">
        <Field
          {...register('name', validators['name'])}
          label={t('Name')}
          mandatory
          placeholder={t('Type name') || ''}
          id="name"
          error={errors.name?.message}
        />

        <ControlledField
          label={t('Version')}
          mandatory
          placeholder={DEFAULT_VERSION}
          id="version"
          error={errors.version?.message}
          control={control}
          name="version"
          rules={validators['version']}
        />

        <Controller
          name="iconUrl"
          control={control}
          render={({ field }) => (
            <LogoSelector
              label={t('Icon')}
              localLogo={field.value?.split('/')?.pop()}
              onLogoSelect={(v) => field.onChange(getLogoId(v))}
              onDeleteLocalLogoHandler={() => field.onChange('')}
              customPlaceholder={t('No icon')}
              className="max-w-full"
              fileManagerModalTitle="Select application icon"
              allowedTypes={IMAGE_TYPES}
              error={errors.iconUrl?.message}
            />
          )}
        />

        <Controller
          name="topics"
          control={control}
          render={({ field }) => (
            <TopicsSelector
              label={t('Topics')}
              values={field.value?.map(topicToOption)}
              options={topicOptions}
              placeholder={t('Select one or more topics')}
              onChange={(v) => field.onChange(v.map((o) => o.value))}
            />
          )}
        />

        <FieldTextArea
          {...register('description')}
          label={t('Description')}
          info={t(
            'The first paragraph serves as a short description. To create an extended description, enter two line breaks and start the second paragraph.',
          )}
          placeholder={t('A description of your application') || ''}
          rows={3}
          className="resize-none"
          id="description"
        />

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
          <CodeEditor
            sourcesFolderId={sources}
            setValue={setValue}
            selectedRuntime={watch('runtime')}
          />
        )}

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

      <ApplicationWizardFooter
        onClose={onClose}
        selectedApplication={selectedApplication}
        isEdit={isEdit}
        isValid={isValid}
      />
    </form>
  );
};
