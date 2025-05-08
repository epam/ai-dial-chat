import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { FilesSelectors } from '@/src/store/files/files.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { CodeEditor } from '@/src/components/Common/CodeEditor';

import { CodeData } from '../form';
import { CodeAppExamples } from './CodeAppExamples';

interface Props {
  sourcesFolderId: string | undefined;
  disabled?: boolean;
}

export const FormCodeEditor = ({ sourcesFolderId, disabled }: Props) => {
  const { setValue } = useFormContext<CodeData>();

  const files = useAppSelector(FilesSelectors.selectFiles);

  const rootFileNames = useMemo(
    () =>
      sourcesFolderId
        ? files
            .filter((file) => file.folderId === sourcesFolderId)
            .map((f) => f.name)
        : [],
    [files, sourcesFolderId],
  );

  useEffect(() => {
    if (sourcesFolderId) {
      setValue('sourceFiles', rootFileNames, { shouldValidate: true });
    }
  }, [rootFileNames, setValue, sourcesFolderId]);

  if (!sourcesFolderId) {
    return null;
  }

  return (
    <>
      {!disabled && (
        <CodeAppExamples fileNames={rootFileNames} folderId={sourcesFolderId} />
      )}
      <CodeEditor readOnly={disabled} sourcesFolderId={sourcesFolderId} />
    </>
  );
};
