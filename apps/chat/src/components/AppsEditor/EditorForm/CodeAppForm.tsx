import React, { useEffect } from 'react';
import {
  Controller,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';

import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { castToString } from '@/src/utils/app/common';
import { doesAgentSupportMcp } from '@/src/utils/app/models';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { FileFolderInterface } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  AuthSelectors,
  FilesSelectors,
} from '@/src/store/selectors';

import {
  AppsEditorQuery,
  CONFIRM_SOURCE_FOLDER_VALUES,
  PUBLIC_APP_TOOLTIP,
} from '@/src/constants/applications';
import { CODE_APPS_ENDPOINTS } from '@/src/constants/code-apps';
import { CommonI18nKeys, MarketplaceI18nKeys } from '@/src/constants/i18n';

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
import { ToolsetLinkButton } from '@/src/components/Marketplace/ToolsetLinkButton';

import { UploadStatus } from '@epam/ai-dial-shared';

const ComboBoxField = withErrorMessage(withLabel(MultipleComboBox));
const ControlledField = withController(Field);
const FilesEditor = withLabel(SourceFilesEditor);
const RuntimeSelector = withController(withLabel(RuntimeVersionSelector));
const MappingsForm = withLabel(
  DynamicFormFields<CodeAppFormType, 'endpoints' | 'env'>,
);
const CopyUrlButton = withLabel(ToolsetLinkButton);

const checkIsTargetFolderLoaded = (
  folders: FileFolderInterface[],
  sources: string,
) => {
  const targetFolder = sources
    ? folders.find((f) => f.id === sources)
    : undefined;

  return targetFolder?.status === UploadStatus.LOADED;
};

const getActualSource = (value: string) =>
  value === MANDATORY_FIELD_PLACEHOLDER ? '' : value;

export const CodeAppForm = () => {
  const { t } = useTranslation(Translation.Marketplace);
  const router = useRouter();

  const { [AppsEditorQuery.PublicationUrl]: publicationUrlQuery = '' } =
    router.query;

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const isAdmin = useAppSelector(AuthSelectors.selectIsAdmin);
  const folders = useAppSelector(FilesSelectors.selectFolders);
  const publicationUrl = publicationUrlQuery.toString();

  const { control, setError, clearErrors, setValue } =
    useFormContext<CodeAppFormType>();
  const { errors } = useFormState<CodeAppFormType>({ control });
  const sources = useWatch<CodeAppFormType, 'sources'>({
    name: 'sources',
    control,
  });
  const filesLoaded = useWatch<CodeAppFormType, 'filesLoaded'>({
    name: 'filesLoaded',
    control,
  });

  const isSharedWithMe = !!appDetails?.sharedWithMe;
  const isAppShared = !!appDetails?.isShared;
  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);
  const isAdminReviewing = isAdmin && (isAppPublic || publicationUrl);

  useEffect(() => {
    const isFolderLoaded = checkIsTargetFolderLoaded(folders, sources);

    if (isFolderLoaded) {
      setValue('filesLoaded', true, { shouldDirty: false });
    }
  }, [setValue, folders, sources]);

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
      data-qa="entity-view-form"
    >
      <Controller
        name="inputAttachmentTypes"
        control={control}
        render={({ field }) => (
          <ComboBoxField
            label={t(MarketplaceI18nKeys.AttachmentTypes)}
            info={t(MarketplaceI18nKeys.InputMIMEType)}
            initialSelectedItems={field.value}
            getItemLabel={castToString}
            getItemValue={castToString}
            onChangeSelectedItems={field.onChange}
            placeholder={t(MarketplaceI18nKeys.EnterAttachmentTypes)}
            className="input-form input-invalid peer mx-0 flex items-start py-1 ps-0 md:max-w-full"
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
        label={t(MarketplaceI18nKeys.MaxAttachmentsNumber)}
        placeholder={t(MarketplaceI18nKeys.EnterMaxAttachments)}
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
            label={t(MarketplaceI18nKeys.SelectFolderWithSourceFiles)}
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
      {!!sources && (filesLoaded || isAdminReviewing) && (
        <FormCodeEditor
          disabled={isAppPublic}
          sourcesFolderId={getActualSource(sources)}
        />
      )}

      <RuntimeSelector
        control={control}
        name="runtime"
        label={t(MarketplaceI18nKeys.RuntimeVersion)}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <MappingsForm
        label={t(MarketplaceI18nKeys.Endpoints)}
        addLabel={t(MarketplaceI18nKeys.AddEndpoint)}
        valueLabel={t(MarketplaceI18nKeys.Endpoint)}
        options={CODE_APPS_ENDPOINTS}
        name="endpoints"
        errors={errors.endpoints}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      <MappingsForm
        creatable
        label={t(MarketplaceI18nKeys.EnvironmentVariables)}
        addLabel={t(MarketplaceI18nKeys.AddVariable)}
        name="env"
        errors={errors.env}
        disabled={isAppPublic}
        tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : ''}
      />

      {doesAgentSupportMcp(appDetails) && (
        <CopyUrlButton
          entity={appDetails}
          label={t(CommonI18nKeys.CopyApplicationEndpointURL)}
        />
      )}
    </div>
  );
};
