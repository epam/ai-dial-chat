import { IconFile, IconTrashX } from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  getFileRootId,
  getIdWithoutRootPathSegments,
} from '@/src/utils/app/id';

import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { SelectFolderModal } from '@/src/components/Files/SelectFolderModal';

import Tooltip from '../../Tooltip';

interface SourceFilesEditorProps {
  value?: string;
  onChange?: (v: string) => void;
}

const _SourceFilesEditor: FC<SourceFilesEditorProps> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation(Translation.Settings);

  const dispatch = useAppDispatch();

  const files = useAppSelector(FilesSelectors.selectFiles);

  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  const folderFiles = useMemo(() => {
    if (value) {
      return files.filter((file) => file.id.startsWith(value));
    }
    return [];
  }, [files, value]);

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
    <div className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
          data-qa="change-source-files-path-container"
          type="button"
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
        </button>

        {!!folderFiles.length &&
          folderFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 rounded border border-accent-secondary p-2"
            >
              <IconFile size={14} />
              <span className="text-sm text-primary">{file.name}</span>
            </div>
          ))}
      </div>

      <SelectFolderModal
        isOpen={isFolderModalOpen}
        initialSelectedFolderId={getFileRootId()}
        rootFolderId={getFileRootId()}
        onClose={handleCloseFileManager}
      />
    </div>
  );
};

export const SourceFilesEditor = memo(_SourceFilesEditor);
