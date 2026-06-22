import { IconCheck, IconCopy } from '@tabler/icons-react';
import { CSSProperties, FC, memo, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';

import classNames from 'classnames';

import { useCopy } from '@/src/hooks/useCopy';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  languageExtensionMapping,
  languageFilenameMapping,
  languageNameMapping,
} from '@/src/utils/app/codeblock';
import { getDownLoadCurrentDate } from '@/src/utils/app/import-export';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/selectors';

import { MarkdownI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import Download from '@/public/images/icons/download.svg';
import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

interface Props {
  language: string;
  value: string;
  isInner: boolean;
  isLastMessageStreaming: boolean;
}

const codeBlockTheme: Record<string, Record<string, CSSProperties>> = {
  dark: oneDark,
  light: oneLight,
};

export const CodeBlock: FC<Props> = memo(
  ({ language, value, isInner, isLastMessageStreaming }) => {
    const { t } = useTranslation(Translation.Markdown);

    const theme = useAppSelector(UISelectors.selectThemeState);

    const { copied: isCopied, onCopy: copyToClipboard } = useCopy(value);

    const lowercaseLanguage = language.toLowerCase();
    const displayLanguage =
      languageNameMapping[lowercaseLanguage] || lowercaseLanguage;

    const downloadAsFile = useCallback(() => {
      // languageExtensionMapping allows set empty extension
      const fileExtension = languageExtensionMapping[displayLanguage] ?? '.txt';
      // use the specific filename if it exists in languageFilenameMapping
      const suggestedFileName =
        languageFilenameMapping[displayLanguage] ??
        `ai-chat-code-${getDownLoadCurrentDate()}${fileExtension}`;
      const fileName = window.prompt(
        t(MarkdownI18nKeys.EnterFileName),
        suggestedFileName,
      );

      if (!fileName) {
        // User pressed cancel on prompt
        return;
      }

      const blob = new Blob([value], { type: 'attachment/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = fileName;
      link.href = url;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, [displayLanguage, t, value]);

    return (
      <div
        className={classNames(
          'codeblock relative rounded border font text-sm text-primary',
          isInner ? 'border-primary' : 'border-secondary',
        )}
      >
        <div
          className={classNames(
            'flex items-center justify-between border-b p-3',
            isInner
              ? 'border-primary bg-layer-3'
              : 'border-secondary bg-layer-1',
          )}
          data-qa="code-title-container"
        >
          <span>{lowercaseLanguage}</span>

          {!isLastMessageStreaming && (
            <div
              data-no-context-menu
              className="flex items-center gap-2 text-secondary"
            >
              <DialGhostIconButton
                tooltipProps={{
                  isTriggerClickable: !isCopied,
                  tooltip: isCopied
                    ? t(MarkdownI18nKeys.Copied)
                    : t(MarkdownI18nKeys.Copy),
                }}
                size={ElementSize.Small}
                onClick={copyToClipboard}
                disabled={isCopied}
                aria-label="Copy-code"
                icon={
                  isCopied ? (
                    <IconCheck size={DEFAULT_ICON_SIZES.SMALL} />
                  ) : (
                    <IconCopy size={DEFAULT_ICON_SIZES.SMALL} />
                  )
                }
              />
              <DialGhostIconButton
                size={ElementSize.Small}
                tooltipProps={{
                  isTriggerClickable: true,
                  tooltip: t(MarkdownI18nKeys.Download),
                }}
                className="flex items-center rounded bg-none hover:text-accent-primary"
                onClick={downloadAsFile}
                icon={
                  <Download
                    width={DEFAULT_ICON_SIZES.SMALL}
                    height={DEFAULT_ICON_SIZES.SMALL}
                  />
                }
                aria-label="Download"
              />
            </div>
          )}
        </div>

        <div className="max-h-[60vh] overflow-auto">
          <SyntaxHighlighter
            language={displayLanguage}
            style={codeBlockTheme[theme] || oneDark}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: 14,
              padding: 12,
              letterSpacing: 0,
            }}
            className={`${isInner ? '!bg-layer-3' : '!bg-layer-1'} font-codeblock`}
            codeTagProps={{
              className: 'font-codeblock',
            }}
          >
            {value}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  },
);
CodeBlock.displayName = 'CodeBlock';
