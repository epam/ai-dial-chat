import { IconCheck, IconCopy } from '@tabler/icons-react';
import { CSSProperties, FC, memo, useCallback, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';

import { useTranslation } from 'next-i18next';

import { programmingLanguages } from '@/src/utils/app/codeblock';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import Download from '../../../public/images/icons/download.svg';
import Tooltip from '../Common/Tooltip';

interface Props {
  language: string;
  value: string;
  isInner?: boolean;
}
const codeBlockTheme: Record<string, Record<string, CSSProperties>> = {
  dark: oneDark,
  light: oneLight,
};

export const CodeBlock: FC<Props> = memo(({ language, value, isInner }) => {
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

  const downloadAsFile = useCallback(() => {
    const fileExtension = programmingLanguages[language] || '.txt';
    const suggestedFileName = `ai-chat-code${fileExtension}`;
    const fileName = window.prompt(
      t('Enter file name') || '',
      suggestedFileName,
    );

    if (!fileName) {
      // user pressed cancel on prompt
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
  }, [language, t, value]);

  return (
    <div
      className={`codeblock relative overflow-hidden rounded border border-primary font text-sm text-primary`}
    >
      <div
        className={`flex items-center justify-between border-b border-primary p-3 ${
          isInner ? 'bg-layer-3' : 'bg-layer-1'
        }`}
      >
        <span className="lowercase">{language}</span>

        <div className="flex items-center gap-3 text-secondary">
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
      </div>

      <SyntaxHighlighter
        language={language}
        style={codeBlockTheme[theme] || oneDark}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: 14,
          padding: 12,
          letterSpacing: 0,
          fontFamily: 'var(--font-inter)',
        }}
        className={`${isInner ? '!bg-layer-3' : '!bg-layer-1'}`}
        codeTagProps={{
          style: {
            fontFamily: 'var(--font-inter)',
          },
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';
