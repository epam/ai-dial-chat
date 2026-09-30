import type { FC, Ref } from 'react';
import { memo } from 'react';
import { HALLOWEEN_PUMPKIN_SILK } from '../../utils/halloween-spider-wrap';
import styles from './Halloween.module.scss';

interface Props {
  /** The corner spider animates the strands through this element. */
  ref?: Ref<SVGSVGElement>;
}

/**
 * The silk the corner spider spins round the pumpkin. Invisible until the
 * spider animates it: every strand starts undrawn and the cocoon transparent.
 */
const HalloweenPumpkinSilk: FC<Props> = ({ ref }) => {
  const { viewBox, cocoon, strands } = HALLOWEEN_PUMPKIN_SILK;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      className={styles.pumpkinSilk}
      aria-hidden="true"
      focusable="false"
    >
      <g data-silk-group="true">
        <ellipse
          data-silk-cocoon="true"
          cx={cocoon.cx}
          cy={cocoon.cy}
          rx={cocoon.rx}
          ry={cocoon.ry}
        />
        {strands.map(({ d }) => (
          <path key={d} data-silk-strand="true" d={d} pathLength="1" />
        ))}
      </g>
    </svg>
  );
};

export default memo(HalloweenPumpkinSilk);
