import type { ICommand, PreviewType } from '@uiw/react-md-editor';
import type { CSSProperties, FC } from 'react';

import dynamic from 'next/dynamic';

import classNames from 'classnames';

// Dynamic import to avoid SSR issues with Markdown Editor
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod),
  { ssr: false },
);

export const EditorThemes = {
  dark: 'dark',
  light: 'light',
} as const;

export type EditorThemes = (typeof EditorThemes)[keyof typeof EditorThemes];

export interface DialMarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  preview?: PreviewType;
  theme?: EditorThemes;
  className?: string;
  placeholder?: string;
  commands?: ICommand[];
}

// TODO: use from UI kit when MDEditor will be ready
export const DialMarkdownEditor: FC<DialMarkdownEditorProps> = ({
  value,
  onChange,
  height = 300,
  preview = 'edit',
  theme = EditorThemes.dark,
  className,
  placeholder,
  commands,
}) => {
  return (
    <div
      data-color-mode={theme}
      className={classNames(
        '[&_.w-md-editor-toolbar]:[--color-fg-default:var(--text-secondary)] [&_.wmde-markdown]:text-sm',
        '[&_.wmde-markdown]:!bg-layer-2 [&_.wmde-markdown]:!text-primary',
        className,
      )}
    >
      <MDEditor
        value={value}
        onChange={(val) => onChange?.(val || '')}
        height={height}
        preview={preview}
        textareaProps={placeholder ? { placeholder } : undefined}
        commands={commands}
        style={
          {
            backgroundColor: 'var(--bg-layer-2)',
            '--md-editor-background-color': 'var(--bg-layer-1)',
            '--color-fg-default': 'var(--text-primary)',
            '--color-accent-fg': 'var(--text-accent-primary)',
            '--color-neutral-muted': 'var(--bg-accent-primary-alpha)',
          } as CSSProperties
        }
      />
    </div>
  );
};
