import { FC, memo, useContext, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { defaultStyle } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

import { useTranslation } from 'next-i18next';

import {
  generateRandomString,
  programmingLanguages,
} from '@/utils/app/codeblock';

import HomeContext from '@/pages/api/home/home.context';

import Check from '../../public/images/icons/check.svg';
import Clone from '../../public/images/icons/clone.svg';
import Download from '../../public/images/icons/download.svg';

interface Props {
  language: string;
  value: string;
}
const codeBlockTheme = {
  dark: oneDark,
  light: defaultStyle,
};

export const CodeBlock: FC<Props> = memo(({ language, value }) => {
  const { t } = useTranslation('markdown');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const {
    state: { lightMode },
  } = useContext(HomeContext);

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
    const fileExtension = programmingLanguages[language] || '.file';
    const suggestedFileName = `file-${generateRandomString(
      3,
      true,
    )}${fileExtension}`;
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
    <div className="codeblock relative border border-gray-400 bg-gray-300 font-sans dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between p-3">
        <span className="lowercase">{language}</span>

        <div className="flex items-center gap-3 border-b border-gray-400 dark:border-gray-700">
          <button
            className="flex items-center [&:not(:disabled)]:hover:text-blue-500"
            onClick={copyToClipboard}
            disabled={isCopied}
          >
            {isCopied ? (
              <Check width={18} height={18} />
            ) : (
              <Clone width={18} height={18} />
            )}
          </button>
          <button
            className="flex items-center rounded bg-none hover:text-blue-500"
            onClick={downloadAsFile}
          >
            <Download width={18} height={18} />
          </button>
        </div>
      </div>

      <SyntaxHighlighter
        language={language}
        style={codeBlockTheme[lightMode]}
        customStyle={{ margin: 0, borderRadius: 0 }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
});
CodeBlock.displayName = 'CodeBlock';
