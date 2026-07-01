import { memo, type FC } from 'react';
import PageLoader from '../PageLoader/PageLoader';

const RouteFallback: FC = () => (
  <div className="flex size-full items-center justify-center">
    <DialSpinner />
  </div>
);
export default memo(RouteFallback);
