import { type OnValidate } from '@monaco-editor/react';
import { type PreviewType } from '@uiw/react-md-editor';
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from 'react';

import dynamic from 'next/dynamic';

import { Label } from '@/src/components/Common/Forms/Label';
import { ToggleSwitch } from '@/src/components/Common/ToggleSwitch/ToggleSwitch';

import {
  DialMarkdownEditor,
  EditorTheme,
  EditorThemes,
} from './MarkdownEditor';

// Dynamic import to avoid SSR issues with Monaco Editor
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.Editor),
  { ssr: false },
);

export interface DialMarkdownEditorContainerProps {
  value?: string;
  onChangeValue?: (value: string) => void;
  label?: ReactNode;
  headerContent?: ReactNode;
  switcherLabel?: string;
  height?: number;
  theme?: EditorTheme;
  onValidateJSON?: OnValidate;
  preview?: PreviewType;
  placeholder?: string;
}

const monacoEditorOptions = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
};

export const DialMarkdownEditorContainer: FC<
  DialMarkdownEditorContainerProps
> = ({
  value,
  onChangeValue,
  label,
  headerContent,
  switcherLabel,
  height = 300,
  theme = EditorThemes.dark,
  onValidateJSON,
  preview = 'edit',
  placeholder,
}) => {
  const [isJSONContentMode, setIsJSONContentMode] = useState(false);
  const [isEditorMounted, setIsEditorMounted] = useState(false);

  useEffect(() => {
    if (isJSONContentMode) {
      setIsEditorMounted(true);
    }
  }, [isJSONContentMode]);

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChangeValue?.(val ?? '');
    },
    [onChangeValue],
  );

  const handleToggleSwitch = useCallback(() => {
    setIsJSONContentMode((prev) => !prev);
  }, []);

  const showSwitcher = Boolean(switcherLabel);

  return (
    <div className="flex w-full flex-col">
      {(label || headerContent || showSwitcher) && (
        <div className="flex items-center justify-between">
          {label && <Label>{label as string}</Label>}
          <div className="flex flex-1 items-center justify-end gap-2">
            {headerContent}
            {showSwitcher && (
              <ToggleSwitch
                isOn={isJSONContentMode}
                handleSwitch={handleToggleSwitch}
                switchOnText="ON"
                switchOFFText="OFF"
                additionalText={switcherLabel}
              />
            )}
          </div>
        </div>
      )}

      {showSwitcher && isJSONContentMode ? (
        <div
          className="rounded border border-primary"
          style={{ height: `${height}px` }}
        >
          {isEditorMounted && (
            <MonacoEditor
              value={value}
              onChange={handleChange}
              onValidate={onValidateJSON}
              language="json"
              theme={theme === EditorThemes.dark ? 'vs-dark' : 'light'}
              height={height}
              options={monacoEditorOptions}
            />
          )}
        </div>
      ) : (
        <DialMarkdownEditor
          value={value}
          onChange={onChangeValue}
          height={height}
          preview={preview}
          theme={theme}
          placeholder={placeholder}
        />
      )}
    </div>
  );
};
