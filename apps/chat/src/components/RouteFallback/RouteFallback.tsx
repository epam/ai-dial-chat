import { DialLoader } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';

const RouteFallback: FC = () => (
  <div className="flex size-full items-center justify-center">
    <DialLoader size={20} />
  </div>
);

export default memo(RouteFallback);
