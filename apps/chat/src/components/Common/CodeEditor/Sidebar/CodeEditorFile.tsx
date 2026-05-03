import { useCallback } from 'react';

import classNames from 'classnames';

import { DialFile } from '@/src/types/files';

import { FileItem } from '@/src/components/Files/FileItem';

interface CodeEditorFileProps {
  file: DialFile;
  isHighlighted: boolean;
  level?: number;
  isModified: boolean;
  readOnly?: boolean;
  onSelectFile: (file: DialFile) => void;
  onDeleteFile: (fileId: string) => void;
  onSave: (fileIds: string[]) => void;
}

export const CodeEditorFile = ({
  file,
  isHighlighted,
  isModified,
  readOnly,
  level = 0,
  onSelectFile,
  onDeleteFile,
  onSave,
}: CodeEditorFileProps) => {
  const handleDelete = useCallback(
    (_: unknown, fileId: string) => {
      onDeleteFile(fileId);
    },
    [onDeleteFile],
  );

  const handleSave = useCallback(
    (fileId: string) => {
      onSave([fileId]);
    },
    [onSave],
  );

  return (
    <div onClick={() => onSelectFile(file)} className="w-full cursor-pointer">
      <FileItem
        iconClassNames="text-secondary"
        wrapperClassNames={classNames(
          'h-[30px] border-l-2',
          isHighlighted
            ? 'border-accent-primary bg-accent-primary-alpha'
            : 'border-transparent',
          isModified && '!text-warning',
        )}
        onEvent={handleDelete}
        onSave={isModified ? handleSave : undefined}
        item={file}
        level={level}
        isCodeEditorFile
        readOnly={readOnly}
      />
    </div>
  );
};
