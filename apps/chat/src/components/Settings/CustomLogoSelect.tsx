import { IconX } from '@tabler/icons-react';
import { MouseEvent, useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ConfirmDialogValueTypes } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Tooltip } from '@/src/components/Common/Tooltip';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';

interface CustomLogoSelectProps {
  localLogo?: string;
  customPlaceholder?: string | null;
  title?: string | null;
  className?: string;
  fileManagerModalTitle?: string;
  allowedTypes?: string[];
  disabled?: boolean;
  tooltip?: string;
  sourceFilters?: Set<FileSourceType>;
  confirmDialogValues?: ConfirmDialogValueTypes;
  warningMessage?: string;
  onLogoSelect: (filesIds: string[]) => void;
  onDeleteLocalLogoHandler: () => void;
}

export const CustomLogoSelect = ({
  localLogo,
  customPlaceholder,
  title,
  className,
  fileManagerModalTitle,
  allowedTypes,
  disabled,
  tooltip,
  sourceFilters,
  confirmDialogValues,
  warningMessage,
  onLogoSelect,
  onDeleteLocalLogoHandler,
}: CustomLogoSelectProps) => {
  const [isSelectFilesDialogOpened, setIsSelectFilesDialogOpened] =
    useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>();
  const [pendingDelete, setPendingDelete] = useState(false);

  const { t } = useTranslation(Translation.Settings);
  const maximumAttachmentsAmount = 1;

  const onClickAddHandler = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsSelectFilesDialogOpened(true);
  };

  const handleSelectFiles = useCallback(
    (files: string[]) => {
      if (files.length > 0) {
        onLogoSelect(files);
      }
      setIsSelectFilesDialogOpened(false);
    },
    [onLogoSelect],
  );

  const handleOnClose = useCallback(
    (files: boolean | string[]) => {
      if (Array.isArray(files) && files.length > 0) {
        if (confirmDialogValues && localLogo) {
          setPendingFiles(files);
          setConfirmDialogOpen(true);
        } else {
          handleSelectFiles(files);
        }
      }
      setIsSelectFilesDialogOpened(false);
    },
    [confirmDialogValues, handleSelectFiles, localLogo],
  );

  const handleDeleteLogo = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (confirmDialogValues) {
      setPendingDelete(true);
      setConfirmDialogOpen(true);
    } else {
      onDeleteLocalLogoHandler();
    }
  };

  const handleConfirmClose = (result: boolean) => {
    if (result) {
      if (pendingDelete) {
        onDeleteLocalLogoHandler();
      } else if (pendingFiles) {
        handleSelectFiles(pendingFiles);
      }
    }

    setConfirmDialogOpen(false);
    setPendingDelete(false);
    setPendingFiles(undefined);
  };

  return (
    <div className="flex items-center gap-5" data-qa="custom-logo">
      {title && <div className="basis-1/3 md:basis-1/4">{t(title)}</div>}
      <div
        className={classNames(
          'flex h-[38px] max-w-[331px] grow basis-2/3 items-center gap-8 overflow-hidden rounded border border-primary px-3 focus-within:border-accent-primary focus:border-accent-primary md:basis-3/4',
          className,
        )}
      >
        <div
          className={classNames(
            'block w-full max-w-full truncate',
            localLogo ? 'text-primary' : 'text-secondary',
          )}
        >
          {localLogo ?? customPlaceholder ?? t('No custom logo')}
        </div>
        <Tooltip tooltip={tooltip}>
          <div className="flex gap-3">
            <button
              onClick={onClickAddHandler}
              className="text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
              disabled={disabled}
            >
              {localLogo ? t('Change') : t('Add')}
            </button>
            {localLogo && (
              <button
                onClick={handleDeleteLogo}
                className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                disabled={disabled}
              >
                <IconX size={18} />
              </button>
            )}
          </div>
        </Tooltip>
      </div>

      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={allowedTypes ?? ['image/*']}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={handleOnClose}
          headerLabel={fileManagerModalTitle || t('Select custom logo')}
          customButtonLabel={t('Select file')}
          customUploadButtonLabel={t('Upload files')}
          forceShowSelectCheckBox
          sourceFilters={sourceFilters}
          warningMessage={warningMessage}
        />
      )}

      {confirmDialogValues && confirmDialogOpen && (
        <ConfirmDialog
          isOpen
          heading={t(confirmDialogValues.heading)}
          description={t(confirmDialogValues.description)}
          confirmLabel={t('Confirm')}
          cancelLabel={t('Cancel')}
          onClose={handleConfirmClose}
        />
      )}
    </div>
  );
};
