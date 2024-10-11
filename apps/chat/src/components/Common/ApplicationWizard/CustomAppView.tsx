import React, { useCallback, useMemo } from 'react';
import { Control, Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classnames from 'classnames';

import { topicToOption } from '@/src/utils/app/application';

import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DEFAULT_VERSION } from '@/src/constants/public';

import { ApplicationWizardFooter } from '@/src/components/Common/ApplicationWizard/ApplicationWizardFooter';
import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldError';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { FormData, getDefaultValues, validators } from './form';
import { ViewProps } from './view-props';

import omit from 'lodash-es/omit';

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);
const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));

const getItemLabel = (item: unknown): string => item as string;

const AttachmentTypeIndicator = ({ item }: { item: unknown }) => (
  <span
    className={classnames(
      validators['inputAttachmentTypes']?.validate?.([item as string], {}) !==
        true && 'text-error',
    )}
  >
    {item as string}
  </span>
);

type TForm = Omit<FormData, 'instructions' | 'temperature' | 'toolset'>;

export const CustomAppView: React.FC<ViewProps> = ({
  onClose,
  isEdit,
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
    handleSubmit: submitWrapper,
  } = useForm<TForm>({
    defaultValues: omit(getDefaultValues(selectedApplication), [
      'instructions',
      'temperature',
      'toolset',
    ]),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const handleSubmit = (data: TForm) => {
    const preparedData = {
      ...data,
      maxInputAttachments: data.maxInputAttachments,
      name: data.name.trim(),
      description: data.description.trim(),
      features: data.features ? JSON.parse(data.features) : null,
      type: EntityType.Application,
      isDefault: false,
      folderId: '',
      topics: data.topics,
    };

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
    <>
      <form
        onSubmit={submitWrapper(handleSubmit)}
        className="relative flex max-h-full w-full grow flex-col divide-tertiary overflow-y-auto"
      >
        <div className="flex flex-col gap-4 overflow-y-auto px-3 pb-6 md:px-6">
          <Field
            {...register('name', { ...validators['name'] })}
            label={t('Name')}
            mandatory
            placeholder={t('Type name') || ''}
            id="name"
            error={errors.name?.message}
          />

          <Field
            {...register('version', { ...validators['version'] })}
            label={t('Version')}
            mandatory
            placeholder={DEFAULT_VERSION}
            id="version"
            error={errors.version?.message}
          />

          <Controller
            name="iconUrl"
            control={control as Control<Partial<FormData>>}
            rules={validators['iconUrl']}
            render={({ field }) => (
              <LogoSelector
                label={t('Icon')}
                mandatory
                localLogo={field.value?.split('/')?.pop()}
                onLogoSelect={(v) => field.onChange(getLogoId(v))}
                onDeleteLocalLogoHandler={() => field.onChange(undefined)}
                customPlaceholder={t('No icon')}
                className="max-w-full"
                fileManagerModalTitle="Select application icon"
                allowedTypes={['image/svg+xml']}
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
            {...register('features', { ...validators['features'] })}
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
            control={control as Control<Partial<FormData>>}
            render={({ field }) => (
              <ComboBoxField
                label={t('Attachment types') || ''}
                info={t("Input the MIME type and press 'Enter' to add")}
                initialSelectedItems={field.value}
                getItemLabel={getItemLabel}
                getItemValue={getItemLabel}
                selectedItemRow={AttachmentTypeIndicator}
                onChangeSelectedItems={field.onChange}
                placeholder={t('Enter one or more attachment types') || ''}
                className="input-form input-invalid peer mx-0 flex items-start py-1 pl-0 md:max-w-full"
                hasDeleteAll
                hideSuggestions
                itemHeightClassName="h-[31px]"
                error={errors.inputAttachmentTypes?.message}
              />
            )}
          />

          <Field
            {...register('maxInputAttachments', {
              ...validators['maxInputAttachments'],
            })}
            label={t('Max. attachments number')}
            placeholder={t('Enter the maximum number of attachments') || ''}
            id="maxInputAttachments"
            error={errors.maxInputAttachments?.message}
          />

          <Field
            {...register('completionUrl', { ...validators['completionUrl'] })}
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
    </>
  );
};
