import { SkillArchiveUploadDialog as SkillArchiveUploadDialogBase } from '@epam/ai-dial-skills';
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
 * Host adapter for `@epam/ai-dial-skills`' `SkillArchiveUploadDialog`: supplies the app's
 * translated labels and accepted-file hint over the reusable presentation component.
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
    <SkillArchiveUploadDialogBase
      isOpen={isOpen}
      errorText={errorText}
      accept={SKILL_ARCHIVE_ACCEPT}
      labels={{
        dialogTitle: t(SkillArchiveImportI18nKeys.DialogTitle),
        dropZoneLabel: t(SkillArchiveImportI18nKeys.DialogDropZoneLabel),
        dropZoneMobileLabel: t(
          SkillArchiveImportI18nKeys.DialogDropZoneMobileLabel,
        ),
        formatsLabel: t(SkillArchiveImportI18nKeys.DialogFormats),
        fileInputAriaLabel: t(SkillArchiveImportI18nKeys.FileInputAriaLabel),
        closeAriaLabel: t(ButtonsI18nKeys.Close),
      }}
      onClose={onClose}
      onFilesSelected={onFilesSelected}
      onFilesRejected={onFilesRejected}
    />
  );
};

export default memo(SkillArchiveUploadDialog);
