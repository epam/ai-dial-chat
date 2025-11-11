import { useEffect, useMemo } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { castToString } from '@/src/utils/app/common';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors, FilesSelectors } from '@/src/store/selectors';

import {
  CONFIRM_SOURCE_FOLDER_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';
import { CODE_APPS_ENDPOINTS } from '@/src/constants/code-apps';

import {
  CodeAppForm as CodeAppFormType,
  MANDATORY_FIELD_PLACEHOLDER,
  getAttachmentTypeErrorHandlers,
} from '@/src/components/AppsEditor/form';
import { FormCodeEditor } from '@/src/components/Common/ApplicationWizard/CodeAppView/FormCodeEditor';
import { RuntimeVersionSelector } from '@/src/components/Common/ApplicationWizard/CodeAppView/RuntimeVersionSelector';
import { SourceFilesEditor } from '@/src/components/Common/ApplicationWizard/CodeAppView/SourceFilesEditor';
import { withController } from '@/src/components/Common/Forms/ControlledFormField';
import { DynamicFormFields } from '@/src/components/Common/Forms/DynamicFormFields';
import { Field } from '@/src/components/Common/Forms/Field';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { withLabel } from '@/src/components/Common/Forms/Label';
import { MultipleComboBox } from '@/src/components/Common/MultipleComboBox';

import { UploadStatus } from '@epam/ai-dial-shared';

const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);
const FilesEditor = withLabel(SourceFilesEditor);
const RuntimeSelector = withController(withLabel(RuntimeVersionSelector));
const MappingsForm = withLabel(
  DynamicFormFields<CodeAppFormType, 'endpoints' | 'env'>,
);

const getActualSource = (value: string) =>
  value === MANDATORY_FIELD_PLACEHOLDER ? '' : value;

export const CodeAppForm = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const folders = useAppSelector(FilesSelectors.selectFolders);

  const { control, formState, setError, clearErrors, watch, setValue } =
    useFormContext<CodeAppFormType>();
  const errors = formState.errors;
  const sources = watch('sources');

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppShared = !!appDetails?.isShared;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);

  const isTargetFolderLoaded = useMemo(() => {
    const targetFolder = sources
      ? folders.find((f) => f.id === sources)
      : undefined;

    return targetFolder?.status === UploadStatus.LOADED;
  }, [folders, sources]);

  useEffect(() => {
    if (isTargetFolderLoaded) {
      setValue('filesLoaded', true, { shouldDirty: false });
    }
  }, [isTargetFolderLoaded, setValue]);

  useEffect(() => {
    if (sources === MANDATORY_FIELD_PLACEHOLDER) {
      setValue('sources', '', { shouldDirty: false, shouldTouch: false });
      setValue('sourceFiles', []);
      clearErrors('sources');
      clearErrors('sourceFiles');
    }
  }, [clearErrors, setValue, sources]);

  return (
    <div
      className="flex size-full grow flex-col space-y-4 divide-tertiary overflow-hidden overflow-y-auto bg-layer-2 px-3 py-4 md:px-5 xl:py-5"
      data-qa="app-view-form"
    >
      <Controller
        name="inputAttachmentTypes"
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
            disabled={isAppPublic}
            tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
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
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <Controller
        name="sources"
        control={control}
        render={({ field }) => (
          <FilesEditor
            mandatory
            value={getActualSource(field.value)}
            onChange={field.onChange}
            label={t('Select folder with source files')}
            error={errors.sources?.message || errors.sourceFiles?.message}
            disabled={isSharedWithMe || isAppPublic}
            tooltip={
              (isAppPublic && PUBLIC_APP_TOOLTIP) ||
              (isSharedWithMe &&
                getSharedTooltip('folder with source files')) ||
              ''
            }
            confirmDialogValues={
              isAppShared ? CONFIRM_SOURCE_FOLDER_VALUES : undefined
            }
          />
        )}
      />
      {sources && (
        <FormCodeEditor
          disabled={isAppPublic}
          sourcesFolderId={getActualSource(sources)}
        />
      )}

      <RuntimeSelector
        control={control}
        name="runtime"
        label={t('Runtime version')}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <MappingsForm
        label={t('Endpoints')}
        addLabel={t('Add endpoint')}
        valueLabel={t('Endpoint')}
        options={CODE_APPS_ENDPOINTS}
        name="endpoints"
        errors={errors.endpoints}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <MappingsForm
        creatable
        label={t('Environment variables')}
        addLabel={t('Add variable')}
        name="env"
        errors={errors.env}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />
    </div>
  );
};
