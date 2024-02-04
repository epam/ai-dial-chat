import { FC } from 'react';

import { modelCursorSign } from '../../constants/chat';

interface BlinkingCursorProps {
  isShowing: boolean;
}
const BlinkingCursor: FC<BlinkingCursorProps> = ({ isShowing }) => {
  return isShowing ? (
    <span className="mt-1 animate-ping cursor-default" data-qa="loading-cursor">
      {modelCursorSign}
    </span>
  ) : null;
};

export default BlinkingCursor;
