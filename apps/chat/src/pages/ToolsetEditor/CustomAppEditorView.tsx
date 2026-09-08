import { GeneralForm } from '@epam/ai-dial-toolset-editor';
import type {
  GeneralFormLabels,
  ToolsetFormErrors,
} from '@epam/ai-dial-toolset-editor';
import { NeutralButton, PrimaryButton } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DialFileManagerModal from '../../components/DialFileManagerModal/DialFileManagerModal';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from '../../constants/files';
import { ToolsetEditorSteps } from '../../constants/toolsets';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  CustomAppI18nKeys,
  DialFileManagerI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import type {
  CustomAppFormData,
  CustomAppFormErrors,
  CustomAppGeneralFormData,
} from '../../models/custom-apps';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import {
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
} from '../../utils/locale';
import CustomAppSettingsForm from './EditorForm/CustomAppSettingsForm';

interface Props {
  step: ToolsetEditorSteps;
  generalForm: CustomAppGeneralFormData;
  generalErrors: ToolsetFormErrors;
  settingsForm: CustomAppFormData;
  settingsErrors: CustomAppFormErrors;
  isSaving: boolean;
  isNextDisabled: boolean;
  onNext: () => void;
  onCancel: () => void;
  onGeneralChange: (patch: Partial<CustomAppGeneralFormData>) => void;
  onSettingsChange: (patch: Partial<CustomAppFormData>) => void;
  onNameBlur: () => void;
  onVersionBlur: () => void;
}

const CustomAppEditorView: FC<Props> = ({
  step,
  generalForm,
  generalErrors,
  settingsForm,
  settingsErrors,
  isSaving,
  isNextDisabled,
  onNext,
  onCancel,
  onGeneralChange,
  onSettingsChange,
  onNameBlur,
  onVersionBlur,
}) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const isGeneralStep = step === ToolsetEditorSteps.General;

  const bucket = user?.bucket ?? '';
  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const labels = useMemo<GeneralFormLabels>(
    () => ({
      form: {
        name: {
          label: t(EditorI18nKeys.NameLabel),
          placeholder: t(CustomAppI18nKeys.NamePlaceholder),
        },
        description: {
          label: t(EditorI18nKeys.DescriptionLabel),
          placeholder: t(CustomAppI18nKeys.DescriptionPlaceholder),
        },
        iconUrl: {
          label: t(EditorI18nKeys.AvatarLabel),
          addAvatarLabel: t(EditorI18nKeys.AddAvatarButtonLabel),
          captionText: t(EditorI18nKeys.AvatarCaption),
        },
        version: {
          label: t(EditorI18nKeys.VersionLabel),
          placeholder: t(EditorI18nKeys.VersionPlaceholder),
        },
        topics: {
          label: t(EditorI18nKeys.TopicsLabel),
          placeholder: t(EditorI18nKeys.TopicsPlaceholder),
        },
        otherLocales: buildLocaleFieldLabels(t),
        ariaLabel: t(EditorI18nKeys.StepGeneral),
      },
      avatarPicker: {
        title: t(EditorI18nKeys.AddAvatarButtonLabel),
        attachLabel: t(DialFileManagerI18nKeys.Attach),
        emptyTitle: t(DialFileManagerI18nKeys.Empty),
        emptyDescription: '',
        errorMessage: t(DialFileManagerI18nKeys.Error),
        retryLabel: t(DialFileManagerI18nKeys.Retry),
        hiddenFilesLabel: t(DialFileManagerI18nKeys.HiddenFiles),
        showHiddenFilesLabel: t(DialFileManagerI18nKeys.ShowHiddenFiles),
        hideHiddenFilesLabel: t(DialFileManagerI18nKeys.HideHiddenFiles),
        getSelectionLabel: (count: number) =>
          t(DialFileManagerI18nKeys.ItemsSelected, { count }),
        uploadFilesLabel: t(DialFileManagerI18nKeys.Upload),
        newFolderLabel: t(DialFileManagerI18nKeys.NewFolder),
        downloadLabel: t(ButtonsI18nKeys.Download),
        downloadingLabel: t(DialFileManagerI18nKeys.Downloading),
        deleteLabel: t(ButtonsI18nKeys.Delete),
        deletingLabel: t(DialFileManagerI18nKeys.DeletingLabel),
        deleteConfirmTitleSingle: t(
          DialFileManagerI18nKeys.DeleteConfirmTitleSingle,
        ),
        deleteConfirmTitleMultiple: t(
          DialFileManagerI18nKeys.DeleteConfirmTitleMultiple,
        ),
        deleteConfirmSingleText: t(BasicI18nKeys.DeleteConfirmDescription),
        deleteConfirmMultipleText: t(
          DialFileManagerI18nKeys.DeleteConfirmBodyMultiple,
        ),
        deleteConfirmItemsLabel: t(
          DialFileManagerI18nKeys.DeleteConfirmBodyItems,
        ),
        deleteConfirmLabel: t(ButtonsI18nKeys.Delete),
        deleteCancelLabel: t(ButtonsI18nKeys.Cancel),
        uploadProgressTitle: t(DialFileManagerI18nKeys.UploadProgressTitle),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
      },
    }),
    [t],
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex h-full w-full min-w-0 flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {isGeneralStep ? (
            <GeneralForm
              form={generalForm}
              errors={generalErrors}
              bucket={bucket}
              FileManagerModal={DialFileManagerModal}
              resolveIconUrl={(url) => resolveCatalogIconUrl(url) ?? ''}
              allowedMimeTypes={AVATAR_ALLOWED_MIME_TYPES}
              maxFileSizeBytes={AVATAR_MAX_FILE_SIZE_BYTES}
              availableLocaleOptions={localeOptions}
              onChange={onGeneralChange}
              onNameBlur={onNameBlur}
              onVersionBlur={onVersionBlur}
              labels={labels}
            />
          ) : (
            <CustomAppSettingsForm
              form={settingsForm}
              errors={settingsErrors}
              onChange={onSettingsChange}
            />
          )}
        </div>

        {isGeneralStep && (
          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-t-tertiary px-4 py-3">
            <NeutralButton
              type="button"
              label={t(ButtonsI18nKeys.Cancel)}
              onClick={onCancel}
              disabled={isSaving}
            />
            <PrimaryButton
              type="button"
              label={t(EditorI18nKeys.NextButton)}
              onClick={onNext}
              disabled={isNextDisabled}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(CustomAppEditorView);
