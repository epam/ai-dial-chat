import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { CodeEditorSelectors, FilesSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Loader } from '@/src/components/Common/Loader';

import { CodeEditorView } from './CodeEditorView';

interface CodeEditorEditorAreaProps {
  readOnly?: boolean;
}

export const CodeEditorEditorArea = ({
  readOnly,
}: CodeEditorEditorAreaProps) => {
  const { t } = useTranslation(Translation.Chat);

  const selectedFileId = useAppSelector(CodeEditorSelectors.selectSelectedFile);
  const isFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);

  if (!selectedFileId && isFilesLoading) return <Loader />;

  if (!selectedFileId) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm">{t(ChatI18nKeys.SelectFileFromTree)}</span>
      </div>
    );
  }

  return <CodeEditorView selectedFileId={selectedFileId} readOnly={readOnly} />;
};
