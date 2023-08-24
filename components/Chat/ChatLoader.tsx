import { FC, useContext } from 'react';

import { Settings } from '@/types/settings';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { modelCursorSign } from './chatConstants';

interface ChatLoaderProps {
  theme: Settings['theme'];
  modelId: string;
}

export const ChatLoader: FC<ChatLoaderProps> = ({ theme, modelId }) => {
  const {
    state: { modelsMap },
  } = useContext(HomeContext);
  return (
    <div
      className="group border-b border-gray-400 bg-gray-200 dark:border-gray-700 dark:bg-gray-800 md:px-4"
      style={{ overflowWrap: 'anywhere' }}
    >
      <div className="m-auto flex gap-4 p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
        <div className="min-w-[40px] items-end">
          <ModelIcon
            entityId={modelId}
            entity={modelsMap[modelId]}
            size={24}
            animate={true}
            inverted={theme === 'dark'}
          />
        </div>

        <span
          className="mt-1 animate-ping cursor-default"
          data-qa="loading-cursor"
        >
          {modelCursorSign}
        </span>
      </div>
    </div>
  );
};
