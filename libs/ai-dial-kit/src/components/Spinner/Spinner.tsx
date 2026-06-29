import { memo, type FC } from 'react';
import styles from './Spinner.module.scss';

/** Props for the {@link Spinner} component. */
export interface SpinnerProps {
  /** Diameter of the spinner ring in pixels. Defaults to `40`. */
  size?: number;
}

/** Full-area loading screen with a gradient spinner. */
export const Spinner: FC<SpinnerProps> = memo(({ size }) => (
  <div className="flex size-full items-center justify-center bg-layer-1">
    <div
      className={styles.spinner}
      style={
        size != null
          ? { width: `${size}px`, height: `${size}px` }
          : { width: '40px', height: '40px' }
      }
    />
  </div>
));
