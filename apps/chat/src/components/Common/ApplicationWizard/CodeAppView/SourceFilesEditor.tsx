import { IconTrashX } from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getFileRootId,
  getIdWithoutRootPathSegments,
} from '@/src/utils/app/id';

import { Translation } from '@/src/types/translation';

import { FilesActions } from '@/src/store/files/files.reducers';
import { useAppDispatch } from '@/src/store/hooks';

import { SelectFolderModal } from '@/src/components/Files/SelectFolderModal';

import { FieldErrorMessage } from '../../Forms/FieldErrorMessage';
import Tooltip from '../../Tooltip';

interface SourceFilesEditorProps {
  value?: string;
  onChange?: (v: string) => void;
  error?: string;
}

const _SourceFilesEditor: FC<SourceFilesEditorProps> = ({
  value,
  onChange,
  error,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  const handleToggleFileManager = useCallback(() => {
    setIsFolderModalOpen((p) => !p);
  }, [setIsFolderModalOpen]);

  const handleCloseFileManager = useCallback(
    (folder?: string) => {
      if (folder) {
        onChange?.(folder);
      }
      setIsFolderModalOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (value) {
      dispatch(FilesActions.getFilesWithFolders({ id: value }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
        data-qa="change-source-files-path-container"
      >
        <div className="flex w-full justify-between truncate whitespace-pre break-all">
          <Tooltip
            tooltip={getIdWithoutRootPathSegments(value ?? '')}
            contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
            triggerClassName={classNames(
              'truncate whitespace-pre',
              !value && 'text-secondary',
            )}
            hideTooltip={!value}
            dataQa="path"
          >
            {value ? getIdWithoutRootPathSegments(value) : t('No folder')}
          </Tooltip>
          <div className="flex items-center gap-3">
            <span
              className="h-full cursor-pointer text-accent-primary"
              data-qa="change-button"
              onClick={handleToggleFileManager}
            >
              {t('Change')}
            </span>
            <button
              onClick={() => {
                onChange?.('');
              }}
              type="button"
              className="text-secondary hover:text-accent-primary"
            >
              <IconTrashX size={18} />
            </button>
          </div>
        </div>
      </div>

      <FieldErrorMessage error={error} className="mt-1" />

      <SelectFolderModal
        isOpen={isFolderModalOpen}
        initialSelectedFolderId={getFileRootId()}
        rootFolderId={getFileRootId()}
        onClose={handleCloseFileManager}
      />
    </>
  );
};

export const SourceFilesEditor = memo(_SourceFilesEditor);
