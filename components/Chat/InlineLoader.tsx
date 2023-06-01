import { FC } from 'react';

import { modelCursorSign } from './chatConstants';

const BlinkingCursor: FC = () => {
  return (
    <span className="animate-ping cursor-default mt-1">{modelCursorSign}</span>
  );
};

export default BlinkingCursor;
