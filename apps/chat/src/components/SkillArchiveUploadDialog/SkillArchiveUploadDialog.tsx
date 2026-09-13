import { FileDropzone, Popup, PopupSize } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { SKILL_ARCHIVE_ACCEPT } from '../../constants/skills';
import {
  ButtonsI18nKeys,
  SkillArchiveImportI18nKeys,
} from '../../constants/translation-keys';

/** Props for `SkillArchiveUploadDialog`. */
interface Props {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Rejection message rendered under the drop area; omit when nothing was rejected. */
  errorText?: string;
  /** Called on Escape, the close button, or an outside click. */
  onClose: () => void;
  /** Called with the picked or dropped files that `accept` allowed through. */
  onFilesSelected: (files: File[]) => void;
  /** Called when a drop carried files that `accept` excluded. */
  onFilesRejected: () => void;
}

/**
 * Dialog the Catalog's "Create → Skill → Upload" action opens, so the user
 * sees the drop area and the supported formats before the file picker
 * appears rather than landing straight in the OS dialog.
 */
const SkillArchiveUploadDialog: FC<Props> = ({
  isOpen,
  errorText,
  onClose,
  onFilesSelected,
  onFilesRejected,
}) => {
  const { t } = useTranslation();

  return (
    <Popup
      open={isOpen}
      size={PopupSize.Sm}
      header={t(SkillArchiveImportI18nKeys.DialogTitle)}
      closeAriaLabel={t(ButtonsI18nKeys.Close)}
      onClose={onClose}
    >
      <div className="px-6 py-4">
        <FileDropzone
          label={
            <>
              <span className="desktop:hidden">
                {t(SkillArchiveImportI18nKeys.DialogDropZoneMobileLabel)}
              </span>
              <span className="hidden desktop:inline">
                {t(SkillArchiveImportI18nKeys.DialogDropZoneLabel)}
              </span>
            </>
          }
          description={t(SkillArchiveImportI18nKeys.DialogFormats)}
          ariaLabel={t(SkillArchiveImportI18nKeys.FileInputAriaLabel)}
          accept={SKILL_ARCHIVE_ACCEPT}
          errorText={errorText}
          onChange={onFilesSelected}
          onReject={onFilesRejected}
        />
      </div>
    </Popup>
  );
};

export default memo(SkillArchiveUploadDialog);
