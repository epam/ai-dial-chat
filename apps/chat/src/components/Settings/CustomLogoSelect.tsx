import React, { MouseEvent, useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { ConfirmDialogValueTypes } from '@/src/types/common';
import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import { SettingsI18nKeys } from '@/src/constants/i18n';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Label } from '@/src/components/Common/Forms/Label';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';

import { DialLinkButton } from '@epam/ai-dial-ui-kit';

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
  isFormView?: boolean;
  maxSelectableFileSize?: number;
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
  maxSelectableFileSize,
  onLogoSelect,
  onDeleteLocalLogoHandler,
  isFormView,
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
    <div
      className={classNames(
        'flex',
        isFormView ? 'flex-col' : 'items-center gap-5',
      )}
      data-qa="custom-logo"
    >
      {title && !isFormView && (
        <div className="basis-1/3 md:basis-1/4">{t(title)}</div>
      )}
      {title && isFormView && <Label>{t(title)}</Label>}
      <div
        className={classNames(
          'flex h-[38px] grow items-center gap-8 overflow-hidden rounded border border-primary px-3 focus-within:border-accent-primary focus:border-accent-primary',
          !isFormView && 'max-w-[331px] basis-2/3 md:basis-3/4',
          className,
        )}
      >
        <div
          className={classNames(
            'block w-full max-w-full truncate text-start',
            localLogo ? 'text-primary' : 'text-secondary',
          )}
        >
          {localLogo || customPlaceholder || t(SettingsI18nKeys.NoCustomLogo)}
        </div>
        <div className="flex gap-3">
          <DialLinkButton
            tooltipProps={{ tooltip: tooltip }}
            onClick={onClickAddHandler}
            disabled={disabled}
            data-qa={localLogo ? 'change-icon' : 'add-icon'}
            label={
              localLogo ? t(SettingsI18nKeys.Change) : t(SettingsI18nKeys.Add)
            }
          />
          {localLogo && (
            <CloseButtonSmall onClick={handleDeleteLogo} disabled={disabled} />
          )}
        </div>
      </div>

      {isSelectFilesDialogOpened && (
        <FileManagerModal
          isOpen
          allowedTypes={allowedTypes ?? ['image/*']}
          maximumAttachmentsAmount={maximumAttachmentsAmount}
          onClose={handleOnClose}
          headerLabel={
            fileManagerModalTitle || t(SettingsI18nKeys.SelectCustomLogo)
          }
          customButtonLabel={t(SettingsI18nKeys.SelectFile)}
          forceShowSelectCheckBox
          sourceFilters={sourceFilters}
          warningMessage={warningMessage}
          maxSelectableFileSize={maxSelectableFileSize}
        />
      )}

      {confirmDialogValues && confirmDialogOpen && (
        <ConfirmDialog
          isOpen
          heading={t(confirmDialogValues.heading)}
          description={t(confirmDialogValues.description)}
          confirmLabel={t(SettingsI18nKeys.ConfirmSettings)}
          cancelLabel={t(SettingsI18nKeys.CancelSettings)}
          onClose={handleConfirmClose}
        />
      )}
    </div>
  );
};
