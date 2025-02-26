import React, { useCallback, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getQuickAppDocumentUrl,
  getSharedTooltip,
  topicToOption,
} from '@/src/utils/app/application';

import { CustomApplicationModel } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { ShareActions } from '@/src/store/share/share.reducers';

import {
  CONFIRM_DOCUMENT_VALUES,
  CONFIRM_ICON_FILE_VALUES,
} from '@/src/constants/applications';
import { IMAGE_TYPES } from '@/src/constants/chat';
import { DEFAULT_VERSION } from '@/src/constants/public';

import { TemperatureSlider } from '@/src/components/Chat/ChatSettings/Temperature';
import { ApplicationWizardFooter } from '@/src/components/Common/ApplicationWizard/ApplicationWizardFooter';
import { DropdownSelector } from '@/src/components/Common/DropdownSelector';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { FieldTextArea } from '@/src/components/Common/Forms/FieldTextArea';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { ModelsSelector } from '@/src/components/Common/ModelsSelector';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';
import { CustomLogoSelect } from '@/src/components/Settings/CustomLogoSelect';

import { withWarningMessage } from '../Forms/FieldWarningMessage';
import {
  FormData,
  getApplicationData,
  getDefaultValues,
  validators,
} from './form';
import { ViewProps } from './view-props';

const LogoSelector = withWarningMessage(
  withErrorMessage(withLabel(CustomLogoSelect)),
);
const TopicsSelector = withLabel(DropdownSelector);
const ToolsetEditor = withErrorMessage(withLabel(MonacoEditor));
const Slider = withLabel(TemperatureSlider, true);
const ControlledField = withController(Field);
const ModelsSelectorField = withErrorMessage(withLabel(ModelsSelector));

const myFilesFilter = new Set([FileSourceType.MY_FILES]);

export const QuickAppView: React.FC<ViewProps> = ({
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
  const models = useAppSelector(ModelsSelectors.selectModels);

  const isSharedWithMe = selectedApplication?.sharedWithMe;

  const modelsWithFolderId = models.map((model) => ({
    ...model,
    folderId: '',
  }));

  const topicOptions = useMemo(() => topics.map(topicToOption), [topics]);

  const {
    register,
    handleSubmit: submitWrapper,
    control,
    formState: { errors, isValid },
  } = useForm<FormData>({
    defaultValues: getDefaultValues({
      app: selectedApplication,
      models: modelsWithFolderId,
    }),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const getLogoId = useCallback(
    (filesIds: string[]) => files.find((f) => f.id === filesIds[0])?.id,
    [files],
  );

  const handleEdit = useCallback(
    (data: FormData) => {
      if (selectedApplication && currentReference) {
        const preparedData = getApplicationData(data, type);

        const applicationData: CustomApplicationModel = {
          ...preparedData,
          reference: currentReference,
          id: selectedApplication.id,
          sharedWithMe: isSharedWithMe,
        };

        dispatch(
          ApplicationActions.update({
            oldApplication: selectedApplication,
            applicationData,
          }),
        );
      }
      onClose(true);
    },
    [
      currentReference,
      dispatch,
      isSharedWithMe,
      onClose,
      selectedApplication,
      type,
    ],
  );

  const handleSubmit = (data: FormData) => {
    const preparedData = getApplicationData(data, type);

    if (
      isEdit &&
      selectedApplication?.isShared &&
      getQuickAppDocumentUrl(preparedData as CustomApplicationModel) !==
        getQuickAppDocumentUrl(selectedApplication)
    ) {
      dispatch(
        ShareActions.revokeAccess({
          resourceId: selectedApplication.id,
          featureType: FeatureType.Application,
        }),
      );
      return;
    } else if (isEdit) {
      handleEdit(data);
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
          {...register('name', { ...validators['name'] })}
          label={t('Name')}
          mandatory
          placeholder={t('Type name')}
          id="name"
          error={errors.name?.message}
          disabled={isSharedWithMe}
          tooltip={isSharedWithMe ? getSharedTooltip('name') : ''}
        />

        <ControlledField
          label={t('Version')}
          mandatory
          placeholder={DEFAULT_VERSION}
          id="version"
          error={errors.version?.message}
          name="version"
          control={control}
          rules={validators['version']}
          disabled={isSharedWithMe}
          tooltip={isSharedWithMe ? getSharedTooltip('version') : ''}
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
              disabled={isSharedWithMe}
              tooltip={isSharedWithMe ? getSharedTooltip('icon') : ''}
              warning={
                selectedApplication?.isShared
                  ? CONFIRM_ICON_FILE_VALUES.description
                  : ''
              }
              confirmDialogValues={CONFIRM_ICON_FILE_VALUES}
            />
          )}
        />

        <Controller
          name="documentRelativeUrl"
          control={control}
          render={({ field }) => (
            <LogoSelector
              label={t('Document relative url')}
              localLogo={field.value?.split('/')?.pop()}
              onLogoSelect={(v) => field.onChange(getLogoId(v))}
              onDeleteLocalLogoHandler={() => field.onChange('')}
              customPlaceholder={t('No document relative url')}
              className="max-w-full"
              fileManagerModalTitle="Select document"
              error={errors.documentRelativeUrl?.message}
              allowedTypes={['*/*']}
              disabled={isSharedWithMe}
              tooltip={isSharedWithMe ? getSharedTooltip('file') : ''}
              sourceFilters={myFilesFilter}
              warning={
                selectedApplication?.isShared
                  ? CONFIRM_DOCUMENT_VALUES.description
                  : ''
              }
              confirmDialogValues={CONFIRM_DOCUMENT_VALUES}
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
            />
          )}
        />

        <FieldTextArea
          {...register('description')}
          label={t('Description')}
          info={t(
            'The first paragraph serves as a short description. To create an extended description, enter two line breaks and start the second paragraph.',
          )}
          placeholder={t('A description of your application')}
          rows={3}
          className="resize-none"
          id="description"
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
        />

        <Controller
          name="temperature"
          control={control}
          render={({ field }) => (
            <Slider
              label={t('Temperature')}
              temperature={field.value}
              onChangeTemperature={field.onChange}
            />
          )}
        />
      </div>

      <ApplicationWizardFooter isEdit={isEdit} isValid={isValid} />
    </form>
  );
};
