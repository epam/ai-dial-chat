import type { CSSProperties } from 'react';

interface FlightOptions {
  count: number;
  sizesPx: readonly number[];
  durationSeconds: number;
  staggerSeconds: number;
}

/** Viewport paths shared by decorative characters, independent of reading direction. */
export const buildFlyingCharacterPaths = ({
  count,
  sizesPx,
  durationSeconds,
  staggerSeconds,
}: FlightOptions): CSSProperties[] =>
  Array.from({ length: count }, (_, index) => {
    const fliesRight = index % 2 === 0;
    const height = 12 + ((index * 17) % 62);
    return {
      '--flight-start-x': fliesRight ? '-22vw' : '115vw',
      '--flight-end-x': fliesRight ? '115vw' : '-22vw',
      '--flight-start-y': `${height}vh`,
      '--flight-mid-y': `${Math.max(3, height - 18)}vh`,
      '--flight-end-y': `${Math.min(84, height + 8)}vh`,
      '--flight-rest-x': `${8 + (index / count) * 78}vw`,
      '--flight-rest-y': `${height}vh`,
      '--flight-facing': fliesRight ? 1 : -1,
      '--flight-size': `${sizesPx[index % sizesPx.length]}px`,
      '--flight-delay': `${(index * staggerSeconds).toFixed(2)}s`,
      '--flight-duration': `${durationSeconds}s`,
    } as CSSProperties;
  });
