import React, { useCallback, useMemo } from 'react';
import { Control, Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { topicToOption } from '@/src/utils/app/application';

import { Translation } from '@/src/types/translation';

import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DEFAULT_VERSION } from '@/src/constants/public';

import { ApplicationWizardFooter } from '@/src/components/Common/ApplicationWizard/ApplicationWizardFooter';
import {
  FormData,
  getDefaultValues,
  validators,
} from '@/src/components/Common/ApplicationWizard/form';
import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldError';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { ViewProps } from '../view-props';

import omit from 'lodash-es/omit';

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);

type TForm = Omit<
  FormData,
  | 'features'
  | 'inputAttachmentTypes'
  | 'maxInputAttachments'
  | 'completionUrl'
  | 'instructions'
  | 'temperature'
  | 'toolset'
>;

export const DeployableView: React.FC<ViewProps> = ({
  onClose,
  isEdit,
  selectedApplication,
}) => {
  const { t } = useTranslation(Translation.Chat);

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
      'features',
      'inputAttachmentTypes',
      'maxInputAttachments',
      'completionUrl',
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

  const handleSubmit = useCallback((_data: TForm) => {
    // TODO: handle submit
  }, []);

  return (
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
          rules={{ ...validators['iconUrl'] }}
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
