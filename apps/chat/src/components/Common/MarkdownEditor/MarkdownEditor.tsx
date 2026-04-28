import MDEditor, { type PreviewType } from '@uiw/react-md-editor';
import type { CSSProperties, FC } from 'react';

import classNames from 'classnames';

export enum EditorThemes {
  dark = 'dark',
  light = 'light',
}

export interface DialMarkdownEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  height?: number;
  preview?: PreviewType;
  theme?: EditorThemes;
  className?: string;
  placeholder?: string;
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
}) => {
  return (
    <div
      data-color-mode={theme}
      className={classNames(
        '[&_.w-md-editor-toolbar]:[--color-fg-default:var(--text-secondary)]',
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
