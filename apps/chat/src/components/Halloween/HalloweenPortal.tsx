import { memo, useEffect, useId, useRef, useState, type FC } from 'react';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import { useReducedMotion } from '../../hooks/celebration/useReducedMotion';
import { getCelebrationHistoryRows } from '../../utils/celebration-history';
import {
  animatePortalRows,
  buildPortalLayout,
  pickPortalRows,
  type PortalLayout,
} from '../../utils/halloween-portal';
import styles from './HalloweenExtras.module.scss';

/** A transient rift borrows visual snapshots; it never owns conversation data. */
const HalloweenPortal: FC = () => {
  const id = useId();
  const isMobile = useIsMobile();
  const reducedMotion = useReducedMotion();
  const copies = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PortalLayout | null>(null);

  useEffect(() => {
    const rows = reducedMotion
      ? []
      : pickPortalRows(getCelebrationHistoryRows());
    const viewport = document.documentElement;
    const next = buildPortalLayout(
      viewport.clientWidth,
      viewport.clientHeight,
      rows,
      isMobile,
    );
    setLayout(next);
    if (!reducedMotion && copies.current)
      return animatePortalRows(rows, copies.current, next.center);
    return undefined;
  }, [isMobile, reducedMotion]);

  return (
    <div
      className={styles.scene}
      data-halloween-scene="portal"
      aria-hidden="true"
    >
      <div ref={copies} className={styles.scene} inert />
      {layout && (
        <>
          <svg
            className={styles.portal}
            style={{
              left: layout.center.x - layout.size / 2,
              top: layout.center.y - layout.size,
              width: layout.size,
              height: layout.size * 2,
            }}
            viewBox="0 0 120 240"
            focusable="false"
          >
            <defs>
              <radialGradient id={`${id}-rift`}>
                <stop stopColor="#03090e" />
                <stop offset="0.7" stopColor="#101c27" />
                <stop offset="0.92" stopColor="#577d73" />
                <stop offset="1" stopColor="#b1efc5" />
              </radialGradient>
            </defs>
            <path
              d="M58 6L83 38L80 62L105 89L96 124L110 153L82 180L80 209L59 234L35 206L38 180L13 155L23 121L11 86L36 62L34 36Z"
              fill={`url(#${id}-rift)`}
              stroke="#b6ffd5"
              strokeWidth="1.5"
            />
            <path
              d="M58 6L52 45L43 67M105 89L87 101M13 155L34 147M59 234L65 193L79 170"
              stroke="#ecffe5"
              strokeWidth="2"
              fill="none"
            />
            <g className={styles.portalEyes}>
              <path
                d="M28 94Q40 87 51 101Q37 109 28 94ZM69 101Q81 87 93 94Q85 109 69 101Z"
                fill="#dbef84"
              />
              <path d="M41 94V103M80 94V103" stroke="#112525" strokeWidth="3" />
            </g>
          </svg>
          <svg
            className={styles.armCanvas}
            viewBox={`0 0 ${Math.max(1, layout.width)} ${Math.max(1, layout.height)}`}
            focusable="false"
          >
            <defs>
              <linearGradient id={`${id}-skin`} x2="0" y2="1">
                <stop stopColor="#aec1a8" />
                <stop offset="0.4" stopColor="#657c73" />
                <stop offset="1" stopColor="#293f45" />
              </linearGradient>
            </defs>
            <g
              className={styles.portalArm}
              style={{
                transformOrigin: `${layout.center.x}px ${layout.center.y}px`,
              }}
            >
              <path
                d={`M${layout.center.x} ${layout.center.y} Q${(layout.center.x + layout.grab.x) / 2} ${layout.grab.y + 45} ${layout.grab.x} ${layout.grab.y}`}
                fill="none"
                stroke={`url(#${id}-skin)`}
                strokeWidth="25"
                strokeLinecap="round"
              />
              <path
                d={`M${layout.center.x} ${layout.center.y - 4} Q${(layout.center.x + layout.grab.x) / 2} ${layout.grab.y + 32} ${layout.grab.x} ${layout.grab.y - 5}`}
                fill="none"
                stroke="#d8e4bc"
                strokeOpacity="0.45"
                strokeWidth="2"
              />
              <g transform={`translate(${layout.grab.x} ${layout.grab.y})`}>
                <path
                  d="M-20 12Q-29-5-16-19Q-6-26 11-17Q25-4 19 17Q1 26-20 12Z"
                  fill={`url(#${id}-skin)`}
                  stroke="#bed0af"
                />
                {[-22, -9, 5, 19].map((x, index) => (
                  <g
                    key={x}
                    className={styles.clawFinger}
                    style={{
                      transformOrigin: `${x}px -5px`,
                      animationDelay: `${index * 0.06}s`,
                    }}
                  >
                    <path
                      d={`M${x} 2Q${x - 13} -16 ${x - 6} -32L${x + 1} -46L${x + 8} -42L${x + 3} -25L${x + 10} -6`}
                      fill={`url(#${id}-skin)`}
                      stroke="#b6c9ad"
                      strokeWidth="1"
                    />
                    <path
                      d={`M${x + 1} -46Q${x + 12} -50 ${x + 13} -33L${x + 8} -42Z`}
                      fill="#ede3c4"
                    />
                    <path d={`M${x - 1} -24L${x + 4} -22`} stroke="#3b5049" />
                  </g>
                ))}
                <path
                  d="M-18 4Q-43-14-39 1L-29 20L-14 19"
                  fill={`url(#${id}-skin)`}
                  stroke="#b6c9ad"
                />
              </g>
            </g>
          </svg>
        </>
      )}
    </div>
  );
};

export default memo(HalloweenPortal);
