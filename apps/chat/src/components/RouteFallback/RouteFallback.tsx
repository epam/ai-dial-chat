import { Spinner } from '@epam/ai-dial-kit';
import { memo, type FC } from 'react';

const RouteFallback: FC = () => <Spinner />;

export default memo(RouteFallback);
