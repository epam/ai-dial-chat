import { useTranslation } from 'next-i18next';

export const NoApiKeySet = () => {
  const { t } = useTranslation('chat');

  return (
    <div className="mx-auto flex h-full w-[300px] flex-col justify-center space-y-6 sm:w-[600px]">
      <div className="text-center text-4xl font-bold text-black dark:text-white">
        Welcome to Chatbot UI
      </div>
      <div className="text-center text-lg text-black dark:text-white">
        <div className="mb-8">{`Chatbot UI is an open source clone of OpenAI's ChatGPT UI.`}</div>
        <div className="mb-2 font-bold">
          Important: Chatbot UI is 100% unaffiliated with OpenAI.
        </div>
      </div>
      <div className="text-center text-gray-500 dark:text-gray-400">
        <div className="mb-2">
          Chatbot UI allows you to plug in your API key to use this UI with
          their API.
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
