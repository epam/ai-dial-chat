import { IconRobot } from '@tabler/icons-react';
import { FC } from 'react';

import { modelCursorSign } from './chatConstants';

export const ChatLoader: FC = () => {
  return (
    <div
      className="group border-b border-black/10 bg-gray-50 text-gray-800 dark:border-gray-900/50 dark:bg-[#444654] dark:text-gray-100"
      style={{ overflowWrap: 'anywhere' }}
    >
      <div className="m-auto flex gap-4 p-4 text-base md:max-w-2xl md:gap-6 md:py-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
        <div className="animate-bounce min-w-[40px] items-end">
          <IconRobot size={30} />
        </div>

        <span className="animate-ping cursor-default mt-1">
          {modelCursorSign}
        </span>
      </div>
    </div>
  );
};
