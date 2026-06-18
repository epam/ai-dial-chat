import { mergeClasses } from '@epam/ai-dial-chat-shared';
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
import { useCodeCopy } from '../../hooks/useCodeCopy';
import styles from './MarkdownCodeBlock.module.scss';

/** Color theme for syntax highlighting. */
export enum CodeBlockTheme {
  Dark = 'dark',
  Light = 'light',
}

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
    codeClassName = 'font-mono text-sm',
  }) => {
    const { isCopied, copy } = useCodeCopy(value);

    return (
      <div
        className={mergeClasses(
          'my-2 overflow-hidden rounded border border-secondary bg-layer-4',
          containerClassName,
        )}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-secondary bg-layer-4 px-3 py-2">
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
                fontSize: 14,
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
