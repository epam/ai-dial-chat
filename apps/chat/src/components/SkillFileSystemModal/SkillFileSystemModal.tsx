import type { AttachResult } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { lazy, memo, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
  SkillEditorI18nKeys,
} from '../../constants/translation-keys';
import FileDeleteConfirmContent from '../FileDeleteConfirmContent/FileDeleteConfirmContent';

const DialFileManagerModal = lazy(async () => {
  const module = await import('../DialFileManagerModal/DialFileManagerModal');
  return { default: module.default };
});

interface Props {
  isOpen: boolean;
  bucket: string;
  onAttach: (result: AttachResult) => void;
  onClose: () => void;
}

/** The DIAL file-manager modal configured for picking files to copy into a skill. */
const SkillFileSystemModal: FC<Props> = ({
  isOpen,
  bucket,
  onAttach,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <DialFileManagerModal
        isOpen={isOpen}
        onClose={onClose}
        onAttach={onAttach}
        bucket={bucket}
        canAttachFolders={false}
        title={t(SkillEditorI18nKeys.OpenFileSystem)}
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
        deletingLabel={t(BasicI18nKeys.DeletingStatus)}
        deleteConfirmBody={(names) => (
          <FileDeleteConfirmContent names={names} />
        )}
        deleteConfirmLabel={t(ButtonsI18nKeys.Delete)}
        deleteCancelLabel={t(ButtonsI18nKeys.Cancel)}
      />
    </Suspense>
  );
};

export default memo(SkillFileSystemModal);
