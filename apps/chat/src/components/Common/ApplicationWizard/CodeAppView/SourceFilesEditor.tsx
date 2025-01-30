import { IconX } from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

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
  tooltip?: string;
  disabled?: boolean;
}

const _SourceFilesEditor: FC<SourceFilesEditorProps> = ({
  value,
  onChange,
  error,
  tooltip,
  disabled,
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
        className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2 hover:border-primary"
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
          <Tooltip tooltip={tooltip}>
            <div className="flex items-center gap-3">
              <button
                className="h-full cursor-pointer text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                data-qa="change-button"
                type="button"
                disabled={disabled}
                onClick={handleToggleFileManager}
              >
                {value ? t('Change') : t('Add')}
              </button>
              {value && (
                <button
                  onClick={() => {
                    onChange?.('');
                  }}
                  type="button"
                  disabled={disabled}
                  className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                >
                  <IconX size={18} />
                </button>
              )}
            </div>
          </Tooltip>
        </div>
      </div>

      <FieldErrorMessage error={error} className="mt-1" />

      <SelectFolderModal
        isOpen={isFolderModalOpen}
        rootFolderId={getFileRootId()}
        onClose={handleCloseFileManager}
        disallowSelectRootFolder
      />
    </>
  );
};

export const SourceFilesEditor = memo(_SourceFilesEditor);
