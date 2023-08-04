import { FC } from 'react';

import { ModelIconMappingType } from '@/types/icons';
import { Settings } from '@/types/settings';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { modelCursorSign } from './chatConstants';

interface ChatLoaderProps {
  theme: Settings['theme'];
  modelIconMapping: ModelIconMappingType;
  modelId: string;
}

export const ChatLoader: FC<ChatLoaderProps> = ({
  theme,
  modelIconMapping,
  modelId,
}) => {
  return (
    <div
      className="group border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100 md:px-4"
      style={{ overflowWrap: 'anywhere' }}
    >
      <div className="m-auto flex gap-4 p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
        <div className="min-w-[40px] items-end">
          <ModelIcon
            size={24}
            animate={true}
            inverted={theme === 'dark'}
            modelIconMapping={modelIconMapping}
            modelId={modelId}
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
