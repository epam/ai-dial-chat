import Editor from '@monaco-editor/react';
import React, { useCallback, useMemo } from 'react';
import { Control, Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import {
  createQuickAppConfig,
  topicToOption,
} from '@/src/utils/app/application';

import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_VERSION } from '@/src/constants/public';

import { TemperatureSlider } from '@/src/components/Chat/Temperature';
import { ApplicationWizardFooter } from '@/src/components/Common/ApplicationWizard/ApplicationWizardFooter';
import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { FormData, getDefaultValues, validators } from './form';
import { ViewProps } from './view-props';

import omit from 'lodash-es/omit';

const LogoSelector = withErrorMessage(withLabel(CustomLogoSelect));
const TopicsSelector = withLabel(DropdownSelector);
const ToolsetEditor = withErrorMessage(withLabel(Editor));
const Slider = withLabel(TemperatureSlider, true);

type TForm = Omit<
  FormData,
  'completionUrl' | 'features' | 'inputAttachmentTypes' | 'maxInputAttachments'
>;

export const QuickAppView: React.FC<ViewProps> = ({
  onClose,
  isEdit,
  currentReference,
  selectedApplication,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const theme = useAppSelector(UISelectors.selectThemeState);
  const topics = useAppSelector(SettingsSelectors.selectTopics);

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

  const {
    register,
    handleSubmit: submitWrapper,
    control,
    formState: { errors, isValid },
  } = useForm<TForm>({
    defaultValues: omit(getDefaultValues(selectedApplication), [
      'completionUrl',
      'features',
      'inputAttachmentTypes',
      'maxInputAttachments',
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
      maxInputAttachments: selectedApplication?.maxInputAttachments,
      name: data.name.trim(),
      description: createQuickAppConfig({
        description: data.description ?? '',
        config: data.toolset,
        instructions: data.instructions ?? '',
        temperature: data.temperature,
        name: data.name.trim(),
      }),
      completionUrl: `http://quickapps.dial-development.svc.cluster.local/openai/deployments/${encodeURIComponent(data.name.trim())}/chat/completions`,
      features: undefined,
      type: EntityType.Application,
      isDefault: false,
      folderId: '',
      topics,
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

          <Controller
            name="toolset"
            control={control as Control<Partial<FormData>>}
            rules={validators['toolset']}
            render={({ field }) => (
              <ToolsetEditor
                label={t('Configure toolset')}
                error={errors.toolset?.message}
                height={200}
                options={{
                  minimap: {
                    enabled: false,
                  },
                  padding: {
                    top: 12,
                    bottom: 12,
                  },
                  scrollBeyondLastLine: false,
                }}
                value={field.value}
                className="m-0.5 w-full overflow-hidden rounded border border-primary"
                language="json"
                onChange={(v) => field.onChange(v ?? '')}
                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
              />
            )}
          />

          <FieldTextArea
            {...register('instructions')}
            label={t('Instructions')}
            placeholder={t('Instructions of your application') || ''}
            rows={4}
            className="resize-none"
            id="instructions"
          />

          <Controller
            name="temperature"
            control={control}
            render={({ field }) => (
              <Slider
                label={t('Temperature') || ''}
                temperature={field.value}
                onChangeTemperature={field.onChange}
              />
            )}
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
