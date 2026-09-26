import { memo, type ComponentType, type CSSProperties, type FC } from 'react';
import styles from './FlyingCharacters.module.scss';

interface Props {
  flights: readonly CSSProperties[];
  Character: ComponentType;
}

/** Animated viewport flights; event modules supply the artwork and flight parameters. */
const FlyingCharacters: FC<Props> = ({ flights, Character }) => (
  <div className={styles.layer} aria-hidden="true">
    {flights.map((style, index) => (
      <span key={index} style={style} className={styles.flight}>
        <span className={styles.facing}>
          <Character />
        </span>
      </span>
    ))}
  </div>
);

export default memo(FlyingCharacters);
