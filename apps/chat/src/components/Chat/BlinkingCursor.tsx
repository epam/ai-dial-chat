import { FC } from 'react';

import { modelCursorSign } from '@/src/constants/chat';

interface BlinkingCursorProps {
  isShowing: boolean;
}

export const BlinkingCursor: FC<BlinkingCursorProps> = ({ isShowing }) => {
  return isShowing ? (
    <span className="mt-1 animate-ping cursor-default" data-qa="loading-cursor">
      {modelCursorSign}
    </span>
  ) : null;
};
