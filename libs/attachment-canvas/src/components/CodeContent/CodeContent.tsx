import {
  CodeBlockTheme,
  mergeClasses,
  restrainedSyntaxTheme,
} from '@epam/ai-dial-chat-shared';
import { lazy, memo, useCallback, useMemo, useState, type FC } from 'react';
import type { CodeCanvasContent } from '../../models/attachment-canvas';
import { LazyContentBoundary } from '../LazyContentBoundary/LazyContentBoundary';
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
 * non-plaintext code language. Recreated as a factory (not a module-scope
 * constant) so a retry after a rejected import produces a genuinely new
 * `lazy()` reference — see `LazyContentBoundary`'s `retryKey` doc.
 */
const createLazySyntaxHighlighter = () =>
  lazy(async () => {
    const { Prism } = await import('react-syntax-highlighter');
    return { default: Prism };
  });

/** User-visible strings for {@link CodeContent}'s syntax-highlighter loading/error states. */
export interface CodeContentLabels {
  /** Accessible status text announced while the highlighter engine loads. Defaults to `'Loading…'`. */
  loadingLabel?: string;
  /** Message shown when the highlighter engine fails to load. Defaults to `'Failed to load content'`. */
  errorLabel?: string;
  /** Label and accessible name for the retry control. Defaults to `'Retry'`. */
  retryLabel?: string;
}

/** Props for {@link CodeContent}. */
export interface CodeContentProps {
  /** The code/text content to render. */
  content: CodeCanvasContent;
  /** Syntax-highlight color theme. Defaults to `CodeBlockTheme.Light`. */
  codeBlockTheme?: CodeBlockTheme;
  /** User-visible strings for the syntax-highlighter loading/error states. All fields have English defaults. */
  labels?: CodeContentLabels;
}

/** Renders syntax-highlighted source code or plain text for a `CodeCanvasContent` payload. */
export const CodeContent: FC<CodeContentProps> = memo(
  ({ content, codeBlockTheme = CodeBlockTheme.Light, labels }) => {
    const { text, language } = content;
    const isPlain = language == null || language === 'plaintext';
    const syntaxTheme = SYNTAX_THEME[codeBlockTheme];
    const isLightTheme = codeBlockTheme === CodeBlockTheme.Light;

    const [retryKey, setRetryKey] = useState(0);
    const LazySyntaxHighlighter = useMemo(createLazySyntaxHighlighter, [
      retryKey,
    ]);
    const handleRetry = useCallback(() => {
      setRetryKey((key) => key + 1);
    }, []);

    const plainTextFallback = (
      <pre className="whitespace-pre-wrap break-words p-4">{text}</pre>
    );

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
          plainTextFallback
        ) : (
          <LazyContentBoundary
            retryKey={retryKey}
            onRetry={handleRetry}
            pendingContent={plainTextFallback}
            errorContent={plainTextFallback}
            labels={labels}
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
          </LazyContentBoundary>
        )}
      </div>
    );
  },
);
