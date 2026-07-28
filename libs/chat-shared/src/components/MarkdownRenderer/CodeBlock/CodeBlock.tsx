import {
  ButtonVariant,
  DIAL_ICON_SIZE,
  DialGhostIconButton,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy, IconDownload } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useCodeCopy } from '../../../hooks/useCodeCopy';
import { CodeBlockTheme } from '../../../types/code-editor';
import { buildCssVars } from '../../../utils/build-css-vars';
import {
  downloadTextFile,
  getFileExtensionForLanguage,
} from '../../../utils/file-download';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './CodeBlock.module.scss';
import { restrainedSyntaxTheme } from './syntax-theme';

/** CSS custom-property overrides for the `MarkdownCodeBlock` component. */
export interface MarkdownCodeBlockColors {
  /** Container background color. */
  background?: string;
  /** Container/header border color. */
  border?: string;
  /** Header background color. */
  headerBackground?: string;
  /** Language label text color. */
  language?: string;
  /** Copy button icon color once copied. */
  copied?: string;
  /** Scrollbar thumb/track color. */
  scrollbar?: string;
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
  /** Accessible label for the download button. Defaults to `'Download code'`. */
  downloadLabel?: string;
  /** Extra classes applied to the outer container element. */
  containerClassName?: string;
  /** Extra classes applied to the sticky header bar. */
  headerClassName?: string;
  /** Typography class for the `<code>` element (used when no language is detected). Defaults to `'dial-code-text'`. */
  codeClassName?: string;
  /** CSS class applied to the language label in the header. Defaults to `'dial-tiny-semi-text uppercase'` plus the module's `.languageLabel` class (`--text-secondary`). */
  languageLabelClassName?: string;
  /** Color overrides applied as CSS custom properties. */
  colors?: MarkdownCodeBlockColors;
}

const syntaxTheme = {
  dark: restrainedSyntaxTheme,
  light: restrainedSyntaxTheme,
};

/** Renders a fenced or multi-line code block with syntax highlighting and a copy button. */
export const MarkdownCodeBlock: FC<MarkdownCodeBlockProps> = memo(
  ({
    language,
    value,
    isStreaming,
    theme = CodeBlockTheme.Dark,
    copyLabel = 'Copy code',
    copiedLabel = 'Copied!',
    downloadLabel = 'Download code',
    containerClassName,
    headerClassName,
    codeClassName = 'dial-code-text',
    languageLabelClassName = 'dial-tiny-semi-text uppercase',
    colors,
  }) => {
    const { isCopied, copy } = useCodeCopy(value);
    const isLightTheme = theme === CodeBlockTheme.Light;
    const handleDownload = () => {
      downloadTextFile(value, `code.${getFileExtensionForLanguage(language)}`);
    };
    const cssVars = buildCssVars({
      '--cm-code-block-bg': colors?.background,
      '--cm-code-block-border': colors?.border,
      '--cm-code-block-header-bg': colors?.headerBackground,
      '--cm-code-block-language': colors?.language,
      '--cm-code-block-copied': colors?.copied,
      '--cm-code-block-scrollbar': colors?.scrollbar,
    });

    return (
      <div
        style={cssVars}
        className={mergeClasses(
          'my-4 max-w-full overflow-hidden rounded-xl border',
          styles.container,
          isLightTheme && styles.containerLight,
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
          <span
            className={mergeClasses(
              styles.languageLabel,
              languageLabelClassName,
            )}
          >
            {language}
          </span>
          {!isStreaming && (
            <div className="flex items-center gap-1">
              <DialGhostIconButton
                icon={<IconDownload size={DIAL_ICON_SIZE.SM} />}
                aria-label={downloadLabel}
                variant={ButtonVariant.Primary}
                size={ElementSize.Small}
                onClick={handleDownload}
              />
              <DialGhostIconButton
                icon={
                  isCopied ? (
                    <IconCheck size={DIAL_ICON_SIZE.SM} />
                  ) : (
                    <IconCopy size={DIAL_ICON_SIZE.SM} />
                  )
                }
                aria-label={isCopied ? copiedLabel : copyLabel}
                variant={ButtonVariant.Primary}
                size={ElementSize.Small}
                className={isCopied ? styles.copiedIcon : undefined}
                onClick={copy}
              />
            </div>
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
              style={syntaxTheme[theme] ?? restrainedSyntaxTheme}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                background: 'transparent',
                fontSize: 14,
                lineHeight: 1.5,
                padding: '14px 16px',
                letterSpacing: 0,
              }}
              codeTagProps={{ className: codeClassName }}
            >
              {value}
            </SyntaxHighlighter>
          ) : (
            <pre className="p-4">
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
