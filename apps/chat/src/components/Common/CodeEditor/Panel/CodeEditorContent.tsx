import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { CodeEditorActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { CodeEditorSelectors, FilesSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { Loader } from '@/src/components/Common/Loader';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';

import debounce, { DebouncedFunc } from 'lodash-es/debounce';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

interface CodeEditorViewProps {
  selectedFileId: string;
  readOnly?: boolean;
}

const CodeEditorView = ({ selectedFileId, readOnly }: CodeEditorViewProps) => {
  const dispatch = useAppDispatch();

  const selectFileContentSelector = useMemo(
    () => CodeEditorSelectors.selectFileContent(selectedFileId),
    [selectedFileId],
  );
  const fileContent = useAppSelector(selectFileContentSelector);
  const isContentLoading = useAppSelector(
    CodeEditorSelectors.selectIsFileContentLoading,
  );

  const [isEditorReady, setIsEditorReady] = useState(false);

  const debouncedChangeHandlerRef = useRef<DebouncedFunc<
    (content: string) => void
  > | null>(null);
  const fileContentRef = useRef<typeof fileContent | undefined>(fileContent);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const modelCacheRef = useRef<
    Record<string, monaco.editor.ITextModel | undefined>
  >({});
  const contentRef = useRef<string | null>(null);
  const editorAliveRef = useRef<boolean>(false);
  const lastCursorPosRef = useRef<Record<string, monaco.IPosition | undefined>>(
    {},
  );

  const editorOptions = useMemo(
    () => (readOnly ? { readOnly: true } : undefined),
    [readOnly],
  );

  useEffect(() => {
    debouncedChangeHandlerRef.current = debounce((content: string) => {
      if (typeof content === 'string') {
        dispatch(
          CodeEditorActions.modifyFileContent({
            fileId: selectedFileId,
            content,
          }),
        );
      }
    }, 300);

    return () => {
      debouncedChangeHandlerRef.current?.cancel();
    };
  }, [dispatch, selectedFileId]);

  useEffect(() => {
    fileContentRef.current = fileContent;
  }, [fileContent]);

  useEffect(() => {
    if (fileContent) {
      contentRef.current = fileContent.modifiedContent ?? fileContent.content;
    }
  }, [fileContent]);

  const detectLanguageIdFromPath = useCallback((path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const langs = monacoRef.current?.languages.getLanguages() ?? [];
    const found = langs.find((l) =>
      (l.extensions ?? []).some((e) => e.replace(/^\./, '') === ext),
    );
    return found?.id ?? 'plaintext';
  }, []);

  useEffect(() => {
    if (
      isEditorReady &&
      monacoRef.current &&
      editorRef.current &&
      typeof contentRef.current === 'string' &&
      !isContentLoading
    ) {
      if (!editorAliveRef.current) return;

      const uri = monacoRef.current.Uri.file(selectedFileId);
      const languageId = detectLanguageIdFromPath(selectedFileId);
      if (
        !modelCacheRef.current[selectedFileId] ||
        modelCacheRef.current[selectedFileId]?.isDisposed()
      ) {
        modelCacheRef.current[selectedFileId] =
          monacoRef.current.editor.createModel(
            contentRef.current,
            languageId,
            uri,
          );
      }

      const model = modelCacheRef.current[selectedFileId]!;
      editorRef.current.setModel(model);

      const key = uri.toString();
      const pos = lastCursorPosRef.current[key] ?? { lineNumber: 1, column: 1 };
      editorRef.current.setPosition(pos);
      editorRef.current.revealPositionInCenterIfOutsideViewport(pos);
      editorRef.current.focus();
    }
  }, [
    selectedFileId,
    isEditorReady,
    isContentLoading,
    detectLanguageIdFromPath,
  ]);

  const handleDebouncedChange = useCallback((content: string | undefined) => {
    if (typeof content === 'string' && debouncedChangeHandlerRef.current) {
      debouncedChangeHandlerRef.current(content);
    }
  }, []);

  const handleBeforeEditorMount = useCallback(() => {
    setIsEditorReady(false);
  }, []);

  const handleEditorMount = useCallback(
    (
      codeEditor: monaco.editor.IStandaloneCodeEditor,
      editorMonaco: typeof monaco,
    ) => {
      editorRef.current = codeEditor;
      monacoRef.current = editorMonaco;

      monacoRef.current.editor.getModels().forEach((model) => model.dispose());

      editorAliveRef.current = true;
      codeEditor.onDidDispose(() => {
        editorAliveRef.current = false;
      });

      codeEditor.onDidChangeCursorPosition(() => {
        const model = codeEditor.getModel();
        if (model) {
          lastCursorPosRef.current[model.uri.toString()] =
            codeEditor.getPosition() ?? { lineNumber: 1, column: 1 };
        }
      });
      codeEditor.onDidChangeModel((e) => {
        const key = e.newModelUrl?.toString();
        const pos = (key && lastCursorPosRef.current[key]) || {
          lineNumber: 1,
          column: 1,
        };

        codeEditor.setPosition(pos);
        codeEditor.revealPositionInCenterIfOutsideViewport(pos);
        codeEditor.focus();
      });

      codeEditor.onKeyDown((e) => {
        if (e.keyCode === 49 && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();

          const value = codeEditor.getValue();
          const currentContent = fileContentRef.current;

          if (
            typeof value === 'string' &&
            currentContent &&
            currentContent.modified
          ) {
            dispatch(
              CodeEditorActions.updateFileContent({
                id: currentContent.id,
                content: value,
              }),
            );
          }
        }
      });

      setIsEditorReady(true);
    },
    [dispatch],
  );

  if (isContentLoading) {
    return <Loader />;
  }

  if (fileContent === undefined) {
    return null;
  }

  return (
    <MonacoEditor
      onChange={handleDebouncedChange}
      onMount={handleEditorMount}
      beforeMount={handleBeforeEditorMount}
      options={editorOptions}
    />
  );
};

interface CodeEditorContentProps {
  readOnly?: boolean;
}

export const CodeEditorContent = ({ readOnly }: CodeEditorContentProps) => {
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
