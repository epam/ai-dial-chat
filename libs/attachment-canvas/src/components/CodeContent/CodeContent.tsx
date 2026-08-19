import {
  CodeBlockTheme,
  mergeClasses,
  restrainedSyntaxTheme,
} from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { CodeCanvasContent } from '../../models/attachment-canvas';
import styles from './CodeContent.module.scss';

const SYNTAX_THEME = {
  [CodeBlockTheme.Dark]: restrainedSyntaxTheme,
  [CodeBlockTheme.Light]: restrainedSyntaxTheme,
};

/** Props for {@link CodeContent}. */
export interface CodeContentProps {
  /** The code/text content to render. */
  content: CodeCanvasContent;
  /** Syntax-highlight color theme. Defaults to `CodeBlockTheme.Light`. */
  codeBlockTheme?: CodeBlockTheme;
}

/** Renders syntax-highlighted source code or plain text for a `CodeCanvasContent` payload. */
export const CodeContent: FC<CodeContentProps> = memo(
  ({ content, codeBlockTheme = CodeBlockTheme.Light }) => {
    const { text, language } = content;
    const isPlain = language == null || language === 'plaintext';
    const syntaxTheme = SYNTAX_THEME[codeBlockTheme];
    const isLightTheme = codeBlockTheme === CodeBlockTheme.Light;

    return (
      <div
        dir="ltr"
        className={mergeClasses(
          'h-full overflow-auto',
          styles.container,
          isLightTheme && styles.containerLight,
        )}
      >
        {isPlain ? (
          <pre className="whitespace-pre-wrap break-words p-4">{text}</pre>
        ) : (
          <SyntaxHighlighter
            language={language}
            style={syntaxTheme}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: 'transparent',
              fontSize: 14,
              lineHeight: 1.5,
              padding: '16px',
              letterSpacing: 0,
            }}
            wrapLongLines
          >
            {text}
          </SyntaxHighlighter>
        )}
      </div>
    );
  },
);
