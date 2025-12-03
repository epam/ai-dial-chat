import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';

import { useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { CodeEditor } from '@/src/components/Common/CodeEditor';

import { CodeData } from '../form';
import { CodeAppExamples } from './CodeAppExamples';

interface FormCodeEditorViewProps {
  sourcesFolderId: string;
  disabled?: boolean;
}

const FormCodeEditorView = ({
  sourcesFolderId,
  disabled,
}: FormCodeEditorViewProps) => {
  const { setValue } = useFormContext<CodeData>();

  const files = useAppSelector(FilesSelectors.selectFiles);

  const rootFileNames = useMemo(
    () =>
      files
        .filter((file) => file.folderId === sourcesFolderId)
        .map((file) => file.name),
    [files, sourcesFolderId],
  );

  useEffect(() => {
    if (sourcesFolderId) {
      setValue('sourceFiles', rootFileNames, { shouldValidate: true });
    }
  }, [rootFileNames, setValue, sourcesFolderId]);

  return (
    <>
      {!disabled && (
        <CodeAppExamples fileNames={rootFileNames} folderId={sourcesFolderId} />
      )}
      <CodeEditor readOnly={disabled} sourcesFolderId={sourcesFolderId} />
    </>
  );
};

interface Props {
  sourcesFolderId: string | undefined;
  disabled?: boolean;
}

export const FormCodeEditor = ({ sourcesFolderId, disabled }: Props) => {
  if (!sourcesFolderId) {
    return null;
  }

  return (
    <FormCodeEditorView sourcesFolderId={sourcesFolderId} disabled={disabled} />
  );
};
