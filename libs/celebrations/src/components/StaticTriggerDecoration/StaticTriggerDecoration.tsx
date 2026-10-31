import { mergeClasses } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { CELEBRATIONS_CLASS } from '../../constants/public-class-names';
import type { CelebrationDecorationProps } from '../../models/celebration';
import styles from './StaticTriggerDecoration.module.scss';

/** English accessible name used when the resolved label is empty. */
export const STATIC_TRIGGER_DEFAULT_LABEL = 'Play celebration';

/** Props of `StaticTriggerDecoration`. */
export interface StaticTriggerDecorationProps extends CelebrationDecorationProps {
  /** Host-built URL of the trigger image; no image renders when `undefined`. */
  imageUrl?: string;
  /** Resolved accessible name. Defaults to `'Play celebration'` when empty. */
  label?: string;
}

/** Native image button that plays a click scene of an external event. */
export const StaticTriggerDecoration: FC<StaticTriggerDecorationProps> = ({
  onActivate,
  imageUrl,
  label,
}) => (
  <button
    type="button"
    className={mergeClasses(styles.trigger, CELEBRATIONS_CLASS.trigger)}
    aria-label={label || STATIC_TRIGGER_DEFAULT_LABEL}
    onClick={onActivate}
  >
    {imageUrl && (
      <img alt="" aria-hidden="true" src={imageUrl} className={styles.image} />
    )}
  </button>
);
