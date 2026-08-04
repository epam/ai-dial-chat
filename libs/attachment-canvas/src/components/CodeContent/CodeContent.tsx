import { mergeClasses, restrainedSyntaxTheme } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import type { CodeCanvasContent } from '../../models/attachment-canvas';

/** Props for {@link CodeContent}. */
export interface CodeContentProps {
  /** The code/text content to render. */
  content: CodeCanvasContent;
}

/** Renders syntax-highlighted source code or plain text for a `CodeCanvasContent` payload. */
export const CodeContent: FC<CodeContentProps> = memo(({ content }) => {
  const { text, language } = content;
  const isPlain = language == null || language === 'plaintext';

  return (
    <div dir="ltr" className="h-full overflow-auto">
      {isPlain ? (
        <pre className={mergeClasses('whitespace-pre-wrap break-words p-4')}>
          {text}
        </pre>
      ) : (
        <SyntaxHighlighter
          language={language}
          style={restrainedSyntaxTheme}
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
});
