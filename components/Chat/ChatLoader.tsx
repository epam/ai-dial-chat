import { FC } from 'react';

import { Settings } from '@/types/settings';

import { useAppSelector } from '@/store/hooks';
import { ModelsSelectors } from '@/store/models/models.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { modelCursorSign } from './chatConstants';

interface ChatLoaderProps {
  theme: Settings['theme'];
  modelId: string;
}

export const ChatLoader: FC<ChatLoaderProps> = ({ theme, modelId }) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
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

        <span className="mt-1 animate-ping cursor-default">
          {modelCursorSign}
        </span>
      </div>
    </div>
  );
};
