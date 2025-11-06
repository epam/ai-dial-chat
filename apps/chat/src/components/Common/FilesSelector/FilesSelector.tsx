import { IconPlus } from '@tabler/icons-react';
import { MouseEvent, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { ConfirmDialogValueTypes } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { Tooltip } from '@/src/components/Common/Tooltip';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';

import { ConfirmDialog } from '../ConfirmDialog';
import { NoFiles } from './NoFiles';
import { SelectedFile } from './SelectedFile';

interface Props {
  files: string[];
  filesFilter?: Set<FileSourceType>;
  fileManagerTitle?: string;
  allowedTypes?: string[];
  readonly?: boolean;
  addBtnTooltip?: string;
  confirmDialogValues?: ConfirmDialogValueTypes;
  tooltip?: string;
  onRemoveFile?: (document: string) => void;
  onAddFiles?: (documents: string[]) => void;
}

export const FilesSelector: React.FC<Props> = ({
  files,
  filesFilter,
  fileManagerTitle,
  allowedTypes = ['*/*'],
  readonly,
  addBtnTooltip,
  confirmDialogValues,
  tooltip,
  onAddFiles,
  onRemoveFile,
}) => {
  const { t } = useTranslation(Translation.Files);

  const [isOpenFileModal, setIsOpenFileModal] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingFilesModel, setPendingFilesModel] = useState<{
    files: string[];
    action: 'delete' | 'add';
  }>({
    action: 'add',
    files: [],
  });

  const handleOpenFilesModal = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsOpenFileModal(true);
  };

  const handleOnCloseFilesModal = useCallback(
    (files: boolean | string[]) => {
      if (Array.isArray(files) && files.length > 0) {
        if (confirmDialogValues) {
          setConfirmDialogOpen(true);
          setPendingFilesModel({ files, action: 'add' });
        } else {
          onAddFiles?.(files);
        }
      }

      setIsOpenFileModal(false);
    },
    [confirmDialogValues, onAddFiles],
  );

  const handleRemoveFile = useCallback(
    (document: string) => {
      if (confirmDialogValues) {
        setConfirmDialogOpen(true);
        setPendingFilesModel({ files: [document], action: 'delete' });
      } else {
        onRemoveFile?.(document);
      }
    },
    [confirmDialogValues, onRemoveFile],
  );

  const handleConfirmClose = useCallback(
    (isConfirmed: boolean) => {
      if (isConfirmed) {
        if (pendingFilesModel.action === 'add') {
          onAddFiles?.(pendingFilesModel.files);
        } else {
          onRemoveFile?.(pendingFilesModel.files[0]);
        }
      }

      setConfirmDialogOpen(false);
    },
    [onAddFiles, onRemoveFile, pendingFilesModel],
  );

  return (
    <Tooltip tooltip={tooltip}>
      <div className="relative grow space-y-4 divide-tertiary">
        <div className="flex flex-col">
          <div className="absolute right-0 top-[-22px]">
            <Tooltip tooltip={addBtnTooltip}>
              <button
                disabled={readonly}
                className={classNames(
                  'flex items-center text-accent-primary',
                  readonly && 'cursor-not-allowed',
                )}
                onClick={handleOpenFilesModal}
              >
                <IconPlus size={18} />
                <p className="ml-2">{t('Add')}</p>
              </button>
            </Tooltip>
          </div>
          {!files.length ? (
            <NoFiles />
          ) : (
            <div className="flex flex-col gap-y-2 overflow-auto rounded border border-primary p-2">
              {files.map((file) => (
                <SelectedFile
                  key={file}
                  document={file}
                  readonly={readonly}
                  onRemove={handleRemoveFile}
                />
              ))}
            </div>
          )}
        </div>
        {isOpenFileModal && !readonly && (
          <FileManagerModal
            isOpen
            onClose={handleOnCloseFilesModal}
            maximumAttachmentsAmount={Number.MAX_SAFE_INTEGER}
            allowedTypes={allowedTypes}
            headerLabel={fileManagerTitle ?? ''}
            customButtonLabel={t('Select files') ?? ''}
            forceShowSelectCheckBox
            sourceFilters={filesFilter}
            warningMessage={confirmDialogValues?.description}
          />
        )}
        {confirmDialogValues && confirmDialogOpen && (
          <ConfirmDialog
            isOpen
            heading={t(confirmDialogValues.heading)}
            description={t(confirmDialogValues.description) ?? ''}
            confirmLabel={t('Confirm')}
            cancelLabel={t('Cancel')}
            onClose={handleConfirmClose}
          />
        )}
      </div>
    </Tooltip>
  );
};
