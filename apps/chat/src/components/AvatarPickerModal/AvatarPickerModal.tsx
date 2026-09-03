import { dialFileToAttachment } from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { lazy, memo, Suspense, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

const DialFileManagerModal = lazy(async () => {
  const module = await import('../DialFileManagerModal/DialFileManagerModal');
  return { default: module.default };
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the picked avatar's DIAL file id once the user confirms a single-image selection. */
  onSelect: (iconUrl: string) => void;
}

/** File manager modal restricted to a single PNG/JPG/SVG image up to 1 MB, for picking an entity's avatar. */
const AvatarPickerModal: FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';

  const handleAttach = useCallback(
    (result: AttachResult) => {
      const [file] = result.files;
      const attachment = file
        ? dialFileToAttachment(file, bucket, {
            resolvePreviewUrl: resolveCatalogIconUrl,
          })
        : null;
      if (attachment) {
        onSelect(attachment.url);
      }
      onClose();
    },
    [bucket, onClose, onSelect],
  );

  return (
    <Suspense fallback={null}>
      {isOpen && (
        <DialFileManagerModal
          isOpen={isOpen}
          onClose={onClose}
          onAttach={handleAttach}
          bucket={bucket}
          allowedTypes={AVATAR_ALLOWED_MIME_TYPES}
          maxSelectableFileSize={AVATAR_MAX_FILE_SIZE_BYTES}
          maximumAttachmentsAmount={1}
          canAttachFolders={false}
          title={t(EditorI18nKeys.AddAvatarButtonLabel)}
          attachLabel={t(DialFileManagerI18nKeys.Attach)}
          emptyTitle={t(DialFileManagerI18nKeys.Empty)}
          emptyDescription=""
          errorMessage={t(DialFileManagerI18nKeys.Error)}
          retryLabel={t(DialFileManagerI18nKeys.Retry)}
          hiddenFilesLabel={t(DialFileManagerI18nKeys.HiddenFiles)}
          showHiddenFilesLabel={t(DialFileManagerI18nKeys.ShowHiddenFiles)}
          hideHiddenFilesLabel={t(DialFileManagerI18nKeys.HideHiddenFiles)}
          getSelectionLabel={(count) =>
            t(DialFileManagerI18nKeys.ItemsSelected, { count })
          }
          uploadFilesLabel={t(DialFileManagerI18nKeys.Upload)}
          newFolderLabel={t(DialFileManagerI18nKeys.NewFolder)}
          downloadLabel={t(ButtonsI18nKeys.Download)}
          downloadingLabel={t(DialFileManagerI18nKeys.Downloading)}
          deleteLabel={t(ButtonsI18nKeys.Delete)}
          deletingLabel={t(DialFileManagerI18nKeys.DeletingLabel)}
          deleteConfirmTitle={(names) =>
            names.length === 1
              ? t(DialFileManagerI18nKeys.DeleteConfirmTitleSingle)
              : t(DialFileManagerI18nKeys.DeleteConfirmTitleMultiple)
          }
          deleteConfirmBody={(names) => (
            <div className="dial-small-text px-6 py-3">
              <p className="mb-3 text-secondary">
                {names.length === 1 ? (
                  <>
                    {t(BasicI18nKeys.DeleteConfirmDescription)}{' '}
                    <span className="break-words text-primary">
                      &quot;{names[0].split('/').pop()}&quot;?
                    </span>
                  </>
                ) : (
                  <>
                    {t(DialFileManagerI18nKeys.DeleteConfirmBodyMultiple)}{' '}
                    <span className="text-primary">
                      {names.length}{' '}
                      {t(DialFileManagerI18nKeys.DeleteConfirmBodyItems)}
                    </span>
                  </>
                )}
              </p>
            </div>
          )}
          deleteConfirmLabel={t(ButtonsI18nKeys.Delete)}
          deleteCancelLabel={t(ButtonsI18nKeys.Cancel)}
          uploadProgressTitle={t(DialFileManagerI18nKeys.UploadProgressTitle)}
          cancelLabel={t(ButtonsI18nKeys.Cancel)}
        />
      )}
    </Suspense>
  );
};

export default memo(AvatarPickerModal);
