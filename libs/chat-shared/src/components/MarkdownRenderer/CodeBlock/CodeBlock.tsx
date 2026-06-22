import {
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { useCodeCopy } from '../../../hooks/useCodeCopy';
import { CodeBlockTheme } from '../../../types/code-editor';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './CodeBlock.module.scss';

/** Props for {@link MarkdownCodeBlock}. */
export interface MarkdownCodeBlockProps {
  /** Detected language from the fenced code block. Empty string for language-less blocks. */
  language: string;
  /** Raw code value with trailing newline stripped. */
  value: string;
  /** When true, the copy button is hidden (streaming in progress). */
  isStreaming?: boolean;
  /** Color theme for syntax highlighting. Defaults to `'dark'`. */
  theme?: CodeBlockTheme;
  /** Accessible label for the copy button. Defaults to `'Copy code'`. */
  copyLabel?: string;
  /** Accessible label for the copy button after copy completes. Defaults to `'Copied!'`. */
  copiedLabel?: string;
  /** Extra classes applied to the outer container element. */
  containerClassName?: string;
  /** Extra classes applied to the sticky header bar. */
  headerClassName?: string;
  /** Typography class for the `<code>` element (used when no language is detected). Defaults to `'font-mono text-sm'`. */
  codeClassName?: string;
}

const syntaxTheme = {
  dark: oneDark,
  light: oneLight,
};

/**
 * Renders a fenced or multiline code block with a sticky header (language label + copy button),
 * syntax highlighting via Prism, a height-constrained scrollable body, and always-LTR code direction.
 */
export const MarkdownCodeBlock: FC<MarkdownCodeBlockProps> = memo(
  ({
    language,
    value,
    isStreaming,
    theme = CodeBlockTheme.Dark,
    copyLabel = 'Copy code',
    copiedLabel = 'Copied!',
    containerClassName,
    headerClassName,
    codeClassName = 'font-mono text-sm',
  }) => {
    const { isCopied, copy } = useCodeCopy(value);

    return (
      <div
        className={mergeClasses(
          'my-4 max-w-full overflow-hidden rounded border',
          styles.container,
          containerClassName,
        )}
      >
        <div
          className={mergeClasses(
            'flex min-h-10 items-center justify-between border-b px-3 py-2',
            styles.header,
            headerClassName,
          )}
        >
          <span className="text-start text-xs opacity-60">{language}</span>
          {!isStreaming && (
            <DialGhostIconButton
              icon={
                isCopied ? (
                  <IconCheck size={DIAL_ICON_SIZE.SM} />
                ) : (
                  <IconCopy size={DIAL_ICON_SIZE.SM} />
                )
              }
              size={ElementSize.Small}
              aria-label={isCopied ? copiedLabel : copyLabel}
              onClick={copy}
            />
          )}
        </div>
        <div
          className={mergeClasses(
            styles.scrollContainer,
            'max-h-[60vh] overflow-auto',
          )}
          dir="ltr"
        >
          {language ? (
            <SyntaxHighlighter
              language={language}
              style={syntaxTheme[theme] ?? oneDark}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                background: 'transparent',
                fontSize: 14,
                lineHeight: 1.5,
                padding: 12,
                letterSpacing: 0,
              }}
              codeTagProps={{ className: codeClassName }}
            >
              {value}
            </SyntaxHighlighter>
          ) : (
            <pre className="p-3">
              <code className={mergeClasses('whitespace-pre', codeClassName)}>
                {value}
              </code>
            </pre>
          )}
        </div>
      </div>
    );
  },
);
