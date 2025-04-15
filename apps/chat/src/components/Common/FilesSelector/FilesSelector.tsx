import { IconPlus } from '@tabler/icons-react';
import { MouseEvent, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { FileSourceType } from '@/src/types/files';
import { Translation } from '@/src/types/translation';

import Tooltip from '@/src/components/Common/Tooltip';
import { FileManagerModal } from '@/src/components/Files/FileManagerModal';

import { NoFiles } from './NoFiles';
import { SelectedFile } from './SelectedFile';

interface Props {
  documents: string[];
  filesFilter?: Set<FileSourceType>;
  fileManagerTitle?: string;
  allowedTypes?: string[];
  readonly?: boolean;
  addBtnTooltip?: string;
  onRemoveDocument?: (document: string) => void;
  onAddDocuments?: (documents: string[]) => void;
}

export const FilesSelector: React.FC<Props> = ({
  documents,
  filesFilter,
  fileManagerTitle,
  allowedTypes = ['*/*'],
  readonly,
  addBtnTooltip,
  onAddDocuments,
  onRemoveDocument,
}) => {
  const { t } = useTranslation(Translation.Files);

  const [isOpenFileModal, setIsOpenFileModal] = useState(false);

  const onAddFiles = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsOpenFileModal(true);
  };

  const handleOnClose = useCallback(
    (files: boolean | string[]) => {
      if (Array.isArray(files) && files.length > 0) {
        onAddDocuments?.(files);
      }

      setIsOpenFileModal(false);
    },
    [onAddDocuments],
  );

  const isEditable = !!onAddDocuments;

  return (
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
              onClick={onAddFiles}
            >
              <IconPlus size={18} />
              <p className="ml-2">{t('Add')}</p>
            </button>
          </Tooltip>
        </div>
        {!documents.length ? (
          <NoFiles />
        ) : (
          <div className="flex flex-col gap-y-2 overflow-auto rounded border border-primary p-2">
            {documents.map((document) => (
              <SelectedFile
                key={document}
                document={document}
                readonly={readonly}
                onRemove={onRemoveDocument}
              />
            ))}
          </div>
        )}
      </div>
      {isOpenFileModal && isEditable && (
        <FileManagerModal
          isOpen
          onClose={handleOnClose}
          maximumAttachmentsAmount={Number.MAX_SAFE_INTEGER}
          allowedTypes={allowedTypes}
          headerLabel={fileManagerTitle ?? ''}
          customButtonLabel={t('Select files') ?? ''}
          forceShowSelectCheckBox
          sourceFilters={filesFilter}
        />
      )}
    </div>
  );
};
