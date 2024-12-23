import { IconCheck, IconCopy } from '@tabler/icons-react';
import { CSSProperties, FC, memo, useCallback, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  languageExtensionMapping,
  languageFilenameMapping,
  languageNameMapping,
} from '@/src/utils/app/codeblock';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import Download from '../../../public/images/icons/download.svg';
import Tooltip from '../Common/Tooltip';

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

export function currentDate() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

export const CodeBlock: FC<Props> = memo(
  ({ language, value, isInner, isLastMessageStreaming }) => {
    const { t } = useTranslation(Translation.Markdown);
    const [isCopied, setIsCopied] = useState<boolean>(false);

    const theme = useAppSelector(UISelectors.selectThemeState);

    const copyToClipboard = useCallback(() => {
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        return;
      }

      navigator.clipboard.writeText(value).then(() => {
        setIsCopied(true);

        setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      });
    }, [value]);

    const displayLanguage = languageNameMapping[language] || language;

    const downloadAsFile = useCallback(() => {
      // languageExtensionMapping allows set empty extension
      const fileExtension = languageExtensionMapping[displayLanguage] ?? '.txt';
      // use the specific filename if it exists in languageFilenameMapping
      const suggestedFileName =
        languageFilenameMapping[displayLanguage] ??
        `ai-chat-code-${currentDate()}${fileExtension}`;
      const fileName = window.prompt(
        t('Enter file name') || '',
        suggestedFileName,
      );

      if (!fileName) {
        // User pressed cancel on prompt
        return;
      }

      const blob = new Blob([value], { type: 'text/plain' });
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
          'codeblock relative overflow-hidden rounded border font text-sm text-primary',
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
        >
          <span className="lowercase">{displayLanguage}</span>

          {!isLastMessageStreaming && (
            <div
              data-no-context-menu
              className="flex items-center gap-3 text-secondary"
            >
              <button
                className="flex items-center [&:not(:disabled)]:hover:text-accent-primary"
                onClick={copyToClipboard}
                disabled={isCopied}
              >
                {isCopied ? (
                  <Tooltip tooltip={t('Copied!')}>
                    <IconCheck size={18} />
                  </Tooltip>
                ) : (
                  <Tooltip isTriggerClickable tooltip={t('Copy code')}>
                    <IconCopy size={18} />
                  </Tooltip>
                )}
              </button>
              <Tooltip isTriggerClickable tooltip={t('Download')}>
                <button
                  className="flex items-center rounded bg-none hover:text-accent-primary"
                  onClick={downloadAsFile}
                >
                  <Download width={18} height={18} />
                </button>
              </Tooltip>
            </div>
          )}
        </div>

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
    );
  },
);
CodeBlock.displayName = 'CodeBlock';
