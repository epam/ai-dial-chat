import { FC, memo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/cjs/styles/prism';

import { useTranslation } from 'next-i18next';

import { programmingLanguages } from '@/utils/app/codeblock';

import { useAppSelector } from '@/store/hooks';
import { UISelectors } from '@/store/ui/ui.reducers';

import Check from '../../public/images/icons/check.svg';
import Clone from '../../public/images/icons/clone.svg';
import Download from '../../public/images/icons/download.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

interface Props {
  language: string;
  value: string;
  isInner?: boolean;
}
const codeBlockTheme = {
  dark: oneDark,
  light: oneLight,
};

export const CodeBlock: FC<Props> = memo(({ language, value, isInner }) => {
  const { t } = useTranslation('markdown');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const theme = useAppSelector(UISelectors.selectThemeState);

  const copyToClipboard = () => {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      return;
    }

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);

      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    });
  };
  const downloadAsFile = () => {
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
  };
  return (
    <div
      className={`codeblock relative overflow-hidden rounded border border-gray-400 font text-sm text-gray-800 dark:border-gray-700 dark:text-gray-200`}
    >
      <div
        className={`mb-[1px] flex items-center justify-between p-3 ${
          isInner
            ? 'bg-gray-100 dark:bg-gray-700'
            : 'bg-gray-300 dark:bg-gray-900'
        }`}
      >
        <span className="lowercase">{language}</span>

        <div className="flex items-center gap-3 text-gray-500">
          <button
            className="flex items-center [&:not(:disabled)]:hover:text-blue-500"
            onClick={copyToClipboard}
            disabled={isCopied}
          >
            {isCopied ? (
              <Tooltip>
                <TooltipTrigger>
                  <Check width={18} height={18} />
                </TooltipTrigger>
                <TooltipContent>{t('Copied!')}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip isTriggerClickable={true}>
                <TooltipTrigger>
                  <Clone width={18} height={18} />
                </TooltipTrigger>
                <TooltipContent>{t('Copy code')}</TooltipContent>
              </Tooltip>
            )}
          </button>
          <Tooltip isTriggerClickable={true}>
            <TooltipTrigger>
              <button
                className="flex items-center rounded bg-none hover:text-blue-500"
                onClick={downloadAsFile}
              >
                <Download width={18} height={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('Download')}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <SyntaxHighlighter
        language={language}
        style={codeBlockTheme[theme]}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: 14,
          padding: 12,
          letterSpacing: 0,
          fontFamily: 'var(--font-inter)',
        }}
        className={`${
          isInner
            ? '!bg-gray-100 dark:!bg-gray-700'
            : '!bg-gray-300 dark:!bg-gray-900'
        }`}
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
