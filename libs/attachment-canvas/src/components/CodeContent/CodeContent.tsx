import {
  CodeBlockTheme,
  mergeClasses,
  restrainedSyntaxTheme,
} from '@epam/ai-dial-chat-shared';
import { lazy, memo, type FC, Suspense } from 'react';
import type { CodeCanvasContent } from '../../models/attachment-canvas';
import styles from './CodeContent.module.scss';

const SYNTAX_THEME = {
  [CodeBlockTheme.Dark]: restrainedSyntaxTheme,
  [CodeBlockTheme.Light]: restrainedSyntaxTheme,
};

/*
 * `AttachmentCanvasBody` mounts `CodeContent` through a static import chain
 * that is itself reachable unconditionally from the app root (see
 * `PdfContent`'s equivalent comment). Loading `react-syntax-highlighter`
 * through a dynamic import here keeps it out of the initial bundle — it's
 * only fetched the first time an attachment actually resolves to a
 * non-plaintext code language.
 */
const LazySyntaxHighlighter = lazy(async () => {
  const { Prism } = await import('react-syntax-highlighter');
  return { default: Prism };
});

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
          <Suspense
            fallback={
              <pre className="whitespace-pre-wrap break-words p-4">{text}</pre>
            }
          >
            <LazySyntaxHighlighter
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
            </LazySyntaxHighlighter>
          </Suspense>
        )}
      </div>
    );
  },
);
