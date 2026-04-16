import MDEditor, { type PreviewType } from '@uiw/react-md-editor';
import type { CSSProperties, FC } from 'react';

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
}

// TODO: use from UI kit when MDEditor will be ready
export const DialMarkdownEditor: FC<DialMarkdownEditorProps> = ({
  value,
  onChange,
  height = 300,
  preview = 'edit',
  theme = EditorThemes.dark,
  className,
}) => {
  return (
    <div data-color-mode={theme} className={className}>
      <MDEditor
        value={value}
        onChange={(val) => onChange?.(val || '')}
        height={height}
        preview={preview}
        style={
          {
            backgroundColor: 'transparent',
            '--color-canvas-default': 'transparent',
            '--md-editor-background-color': 'var(--bg-layer-1)',
          } as CSSProperties
        }
      />
    </div>
  );
};
