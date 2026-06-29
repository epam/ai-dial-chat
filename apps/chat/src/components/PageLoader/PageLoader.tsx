import { memo, type FC } from 'react';
import styles from './PageLoader.module.scss';

/**
 * Full-area loading screen using the catalog background color with a
 * gradient spinner matching the "+ Create" button colors.
 */
const PageLoader: FC = () => (
  <div className="flex size-full items-center justify-center bg-layer-1">
    <div className={styles.spinner} />
  </div>
);

export default memo(PageLoader);
