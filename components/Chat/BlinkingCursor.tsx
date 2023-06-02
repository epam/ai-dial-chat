import { FC, useContext } from 'react';

import { modelCursorSign } from './chatConstants';

interface BlinkingCursorProps {
  isShowing: boolean;
}
const BlinkingCursor: FC<BlinkingCursorProps> = ({ isShowing }) => {
  return isShowing ? (
    <span className="animate-ping cursor-default mt-1">{modelCursorSign}</span>
  ) : null;
};

export default BlinkingCursor;
