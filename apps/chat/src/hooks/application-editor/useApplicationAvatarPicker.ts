import type {
  AvatarPickerModalLabels,
  MetadataFormAvatarPicker,
} from '@epam/ai-dial-builder-form';
import { dialFileToAttachment } from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DialFileManagerModal from '../../components/DialFileManagerModal/DialFileManagerModal';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from '../../constants/files';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { resolveCatalogIconUrl } from '../../utils/icon-path';

/** Avatar-picker wiring and translated labels shared by every entity editor. */
export interface ApplicationAvatarPicker {
  /** Wiring for `MetadataForm`'s `avatarPicker` prop. */
  avatarPicker: MetadataFormAvatarPicker;
  /** Translated labels for the picker's file-manager modal. */
  avatarPickerLabels: AvatarPickerModalLabels;
}

const resolveIconUrl = (url: string): string =>
  resolveCatalogIconUrl(url) ?? '';

/**
 * Builds the avatar picker every entity editor needs: the user's bucket, the
 * app's file manager, icon URL resolution, the avatar file limits, and the
 * translated picker labels.
 *
 * Each editor used to build this — the label object alone is two dozen
 * keys — in its own page, and the copies drifted. It is built here once.
 */
export const useApplicationAvatarPicker = (): ApplicationAvatarPicker => {
  const { t } = useTranslation();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';

  const resolveAttachedIconUrl = useCallback(
    (result: AttachResult) => {
      const [file] = result.files;
      const attachment = file
        ? dialFileToAttachment(file, bucket, {
            resolvePreviewUrl: resolveIconUrl,
          })
        : null;
      return attachment?.url;
    },
    [bucket],
  );

  const avatarPicker = useMemo<MetadataFormAvatarPicker>(
    () => ({
      bucket,
      FileManagerModal: DialFileManagerModal,
      resolveIconUrl,
      resolveAttachedIconUrl,
      allowedMimeTypes: AVATAR_ALLOWED_MIME_TYPES,
      maxFileSizeBytes: AVATAR_MAX_FILE_SIZE_BYTES,
    }),
    [bucket, resolveAttachedIconUrl],
  );

  const avatarPickerLabels = useMemo<AvatarPickerModalLabels>(
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

  return useMemo(
    () => ({ avatarPicker, avatarPickerLabels }),
    [avatarPicker, avatarPickerLabels],
  );
};
