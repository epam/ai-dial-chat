import { FC } from 'react';

import { modelCursorSign } from './chatConstants';

interface BlinkingCursorProps {
  isShowing: boolean;
}
const BlinkingCursor: FC<BlinkingCursorProps> = ({ isShowing }) => {
  return isShowing ? (
    <span className="mt-1 animate-ping cursor-default">{modelCursorSign}</span>
  ) : null;
};

export default BlinkingCursor;
