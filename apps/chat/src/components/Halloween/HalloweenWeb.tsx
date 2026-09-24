import { memo, type CSSProperties, type FC } from 'react';
import styles from './Halloween.module.scss';
import HalloweenSpider from './HalloweenSpider';

/* Shared geometry keeps the spider on the tip of the silk as it is drawn.
   Twelve spokes and six scalloped turns leave the content readable beneath. */
const SPOKE_COUNT = 12;
const TURN_COUNT = 6;
const pointOnWeb = (radius: number, angle: number) => ({
  x: 120 + Math.cos(angle) * radius,
  y: 120 + Math.sin(angle) * radius,
});
const coordinates = ({ x, y }: { x: number; y: number }) =>
  `${x.toFixed(2)} ${y.toFixed(2)}`;
const SPOKES = Array.from({ length: SPOKE_COUNT }, (_, index) => {
  const angle = (index / SPOKE_COUNT) * Math.PI * 2;
  return `M120 120L${coordinates(pointOnWeb(116, angle))}`;
});
const SPIRAL = Array.from({ length: SPOKE_COUNT * TURN_COUNT }, (_, index) => {
  const angle = ((index + 1) / SPOKE_COUNT) * Math.PI * 2;
  const radius = 6 + ((index + 1) / (SPOKE_COUNT * TURN_COUNT)) * 110;
  const control = pointOnWeb(
    (radius - 1) * 0.94,
    angle - Math.PI / SPOKE_COUNT,
  );
  return `Q${coordinates(control)} ${coordinates(pointOnWeb(radius, angle))}`;
}).join(' ');
const SILK_PATH = `M126 120 ${SPIRAL}`;

interface Props {
  style: CSSProperties;
}

/** A spider follows a growing silk spiral; the whole patch fades before cleanup. */
const HalloweenWeb: FC<Props> = ({ style }) => (
  <div className={styles.webPatch} style={style} aria-hidden="true">
    <svg viewBox="0 0 240 240" className={styles.webDrawing} focusable="false">
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
        opacity="0.3"
        style={{
          transform: 'rotate(var(--web-rotation))',
          transformOrigin: '120px 120px',
        }}
      >
        {SPOKES.map((spoke) => (
          <path
            key={spoke}
            d={spoke}
            pathLength="1"
            className={styles.webSpoke}
          />
        ))}
        <path d={SILK_PATH} pathLength="1" className={styles.webSilk} />
      </g>
    </svg>
    <svg viewBox="0 0 240 240" className={styles.webRunner} focusable="false">
      <g
        style={{
          transform: 'rotate(var(--web-rotation))',
          transformOrigin: '120px 120px',
        }}
      >
        <g
          className={styles.webWeaver}
          style={{ offsetPath: `path('${SILK_PATH}')` }}
        >
          <g transform="translate(-15 -14)">
            <HalloweenSpider width="30" height="28" />
          </g>
        </g>
      </g>
    </svg>
  </div>
);

export default memo(HalloweenWeb);
