import { IconFile, IconFolder } from '@tabler/icons-react';
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { getFileRootId } from '@/src/utils/app/id';

import { Translation } from '@/src/types/translation';

import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { SelectFolderModal } from '@/src/components/Files/SelectFolderModal';

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
          type="button"
          className="button button-primary"
          onClick={handleToggleFileManager}
        >
          <IconFolder size={18} />
        </button>

        {!value && <span>{t('Select folder')}</span>}
        {!!folderFiles.length && (
          <span className="text-lg text-primary">{'>'}</span>
        )}
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
