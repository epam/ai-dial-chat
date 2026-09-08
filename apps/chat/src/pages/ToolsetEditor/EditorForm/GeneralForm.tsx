import { dialFileToAttachment } from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type {
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
} from '@epam/ai-dial-deployment-creation-form';
import {
  AvatarPickerModal,
  DeploymentCreationForm,
} from '@epam/ai-dial-deployment-creation-form';
import type { FC } from 'react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DialFileManagerModal from '../../../components/DialFileManagerModal/DialFileManagerModal';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from '../../../constants/files';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
  EditorI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useUser } from '../../../context/auth/UserContext';
import type { CustomAppGeneralFormData } from '../../../models/custom-apps';
import type { ToolsetFormErrors } from '../../../models/toolsets';
import { resolveCatalogIconUrl } from '../../../utils/icon-path';
import {
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
} from '../../../utils/locale';

interface Props {
  form: CustomAppGeneralFormData;
  errors: ToolsetFormErrors;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  onChange: (patch: Partial<CustomAppGeneralFormData>) => void;
  onNameBlur?: () => void;
  onVersionBlur?: () => void;
}

const GeneralForm: FC<Props> = ({
  form,
  errors,
  namePlaceholder,
  descriptionPlaceholder,
  onChange,
  onNameBlur,
  onVersionBlur,
}) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const iconPreviewUrl = useMemo(
    () => resolveCatalogIconUrl(form.iconUrl),
    [form.iconUrl],
  );

  const labels: DeploymentCreationFormLabels = useMemo(
    () => ({
      name: {
        label: t(EditorI18nKeys.NameLabel),
        placeholder: namePlaceholder,
      },
      description: {
        label: t(EditorI18nKeys.DescriptionLabel),
        placeholder: descriptionPlaceholder,
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
        placeholder: t(ToolsetEditorI18nKeys.TopicsPlaceholder),
      },
      otherLocales: buildLocaleFieldLabels(t),
      ariaLabel: t(EditorI18nKeys.StepGeneral),
    }),
    [t, namePlaceholder, descriptionPlaceholder],
  );

  const avatarPickerLabels = useMemo(
    () => ({
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
    }),
    [t],
  );

  const values: DeploymentCreationFormValues = {
    name: form.name,
    description: form.description,
    iconUrl: form.iconUrl,
    version: form.version,
    topics: form.topics,
    otherLocales: form.otherLocales,
  };

  return (
    <>
      <DeploymentCreationForm
        values={values}
        errors={errors}
        onChange={onChange}
        onNameBlur={onNameBlur}
        onVersionBlur={onVersionBlur}
        iconPreviewUrl={iconPreviewUrl}
        onAddAvatarClick={() => setIsAvatarPickerOpen(true)}
        labels={labels}
        availableLocaleOptions={localeOptions}
      />
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        onAttach={(result: AttachResult) => {
          const [file] = result.files;
          const attachment = file
            ? dialFileToAttachment(file, bucket, {
                resolvePreviewUrl: resolveCatalogIconUrl,
              })
            : null;
          if (attachment?.url) {
            onChange({ iconUrl: attachment.url });
          }
          setIsAvatarPickerOpen(false);
        }}
        bucket={bucket}
        FileManagerModal={DialFileManagerModal}
        allowedMimeTypes={AVATAR_ALLOWED_MIME_TYPES}
        maxFileSizeBytes={AVATAR_MAX_FILE_SIZE_BYTES}
        labels={avatarPickerLabels}
      />
    </>
  );
};

export default memo(GeneralForm);
