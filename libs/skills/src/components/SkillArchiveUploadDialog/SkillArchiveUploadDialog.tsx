import { FileDropzone, Popup, PopupSize } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import type { SkillArchiveUploadDialogProps } from '../../models/skill-archive-upload-dialog-props';

const DEFAULT_ACCEPT = '.zip,.md';

/**
 * Dialog presenting the drop area and supported formats for a skill-archive upload, so the host
 * can start the flow before the native file picker appears. Presentation only — the host wires
 * selection/rejection/close to its own import controller.
 */
export const SkillArchiveUploadDialog: FC<SkillArchiveUploadDialogProps> = ({
  isOpen,
  errorText,
  accept = DEFAULT_ACCEPT,
  labels,
  onClose,
  onFilesSelected,
  onFilesRejected,
}) => {
  const {
    dialogTitle = 'Upload skill',
    dropZoneLabel = 'Drag and drop it or click here to upload',
    dropZoneMobileLabel = 'Click here to upload',
    formatsLabel = 'File formats .zip and SKILL.md',
    fileInputAriaLabel = 'Upload a skill ZIP archive or a SKILL.md file',
    closeAriaLabel = 'Close',
  } = labels ?? {};

  return (
    <Popup
      open={isOpen}
      size={PopupSize.Sm}
      header={dialogTitle}
      closeAriaLabel={closeAriaLabel}
      onClose={onClose}
    >
      <div className="px-6 py-4">
        <FileDropzone
          label={
            <>
              <span className="desktop:hidden">{dropZoneMobileLabel}</span>
              <span className="hidden desktop:inline">{dropZoneLabel}</span>
            </>
          }
          description={formatsLabel}
          ariaLabel={fileInputAriaLabel}
          accept={accept}
          errorText={errorText}
          onChange={onFilesSelected}
          onReject={onFilesRejected}
        />
      </div>
    </Popup>
  );
};
