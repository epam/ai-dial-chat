import React, { useCallback, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { topicToOption } from '@/src/utils/app/application';

import { CustomApplicationModel } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { IMAGE_TYPES } from '@/src/constants/chat';
import { DEFAULT_VERSION } from '@/src/constants/public';

import { ApplicationWizardFooter } from '@/src/components/Common/ApplicationWizard/ApplicationWizardFooter';
import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import {
  FormData,
  getApplicationData,
  getAttachmentTypeErrorHandlers,
  getDefaultValues,
  validators,
} from './form';
import { ViewProps } from './view-props';

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);

const getItemLabel = (item: unknown): string => item as string;

export const CustomAppView: React.FC<ViewProps> = ({
  onClose,
  isEdit,
  type,
  currentReference,
  selectedApplication,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const topics = useAppSelector(SettingsSelectors.selectTopics);

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

  const {
    register,
    control,
    formState: { errors, isValid },
    setError,
    clearErrors,
    handleSubmit: submitWrapper,
  } = useForm<FormData>({
    defaultValues: getDefaultValues(selectedApplication),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const handleSubmit = (data: FormData) => {
    const preparedData = getApplicationData(data, type);

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
          rules={validators['iconUrl']}
          render={({ field }) => (
            <LogoSelector
              label={t('Icon')}
              mandatory
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

        <FieldTextArea
          {...register('features', validators['features'])}
          label={t('Features data')}
          info={t(
            'Enter key-value pairs for rate_endpoint and/or configuration_endpoint in JSON format.',
          )}
          placeholder={`{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`}
          id="features"
          rows={4}
          data-qa="features-data"
          error={errors.features?.message}
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
              getItemLabel={getItemLabel}
              getItemValue={getItemLabel}
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

        <Field
          {...register('completionUrl', validators['completionUrl'])}
          label={t('Completion URL')}
          mandatory
          placeholder={t('Type completion URL') || ''}
          id="completionUrl"
          error={errors.completionUrl?.message}
          data-qa="completion-url"
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
