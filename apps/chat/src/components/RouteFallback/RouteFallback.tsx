import { memo, type FC } from 'react';
import PageLoader from '../PageLoader/PageLoader';

const RouteFallback: FC = () => <PageLoader />;

export default memo(RouteFallback);
