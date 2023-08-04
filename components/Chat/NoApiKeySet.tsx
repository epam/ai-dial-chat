import { FC } from 'react';

import { useTranslation } from 'next-i18next';

interface NoApiKeySetProps {
  appName: string;
}
export const NoApiKeySet: FC<NoApiKeySetProps> = ({ appName }) => {
  const { t } = useTranslation('chat');

  return (
    <div className="mx-auto flex h-full w-[300px] flex-col justify-center space-y-6 sm:w-[600px]">
      <div className="text-center text-4xl font-bold text-black dark:text-white">
        {t('Welcome to {{appName}}', { appName })}
      </div>
      <div className="text-center text-lg text-black dark:text-white">
        <div className="mb-8">
          {t(`{{ appName }} is an open source clone of OpenAI's ChatGPT UI.`, {
            appName,
          })}
        </div>
        <div className="mb-2 font-bold">
          {t('Important: {{ appName }} is 100% unaffiliated with OpenAI.', {
            appName,
          })}
        </div>
      </div>
      <div className="text-center text-gray-500 dark:text-gray-400">
        <div className="mb-2">
          {t(
            '{{ appName }} allows you to plug in your API key to use this UI with their API.',
            { appName },
          )}
        </div>
        <div className="mb-2">
          It is <span className="italic">only</span> used to communicate with
          their API.
        </div>
        <div className="mb-2">
          {t(
            'Please set your OpenAI API key in the bottom left of the sidebar.',
          )}
        </div>
        <div>
          {t("If you don't have an OpenAI API key, you can get one here: ")}
          <a
            href="https://platform.openai.com/account/api-keys"
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 hover:underline"
          >
            openai.com
          </a>
        </div>
      </div>
    </div>
  );
};

NoApiKeySet.displayName = 'Chat';
