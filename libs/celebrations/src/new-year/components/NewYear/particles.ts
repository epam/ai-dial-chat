import type { CSSProperties } from 'react';
import { NewYearScene } from './types';

/** Scatter short-lived particles once per scene, keeping a static reduced-motion layout. */
export const buildNewYearParticles = (
  scene: NewYearScene.Snow | NewYearScene.Confetti,
  isMobile: boolean,
): CSSProperties[] => {
  const isSnow = scene === NewYearScene.Snow;
  const count = isSnow ? (isMobile ? 28 : 48) : isMobile ? 36 : 64;
  return Array.from({ length: count }, (_, index) => {
    const x = 3 + (index / count) * 94;
    const size = isSnow ? 3 + Math.random() * 4 : 4 + Math.random() * 4;
    return {
      '--particle-x': `${x.toFixed(1)}vw`,
      '--particle-rest-y': `${12 + Math.random() * 70}vh`,
      '--particle-size': `${size.toFixed(1)}px`,
      '--particle-drift': `${((index % 2 === 0 ? 1 : -1) * (12 + Math.random() * 30)).toFixed(1)}px`,
      '--particle-duration': `${(isSnow ? 7 + Math.random() * 2 : 5 + Math.random()).toFixed(2)}s`,
      '--particle-delay': `${(Math.random() * 2).toFixed(2)}s`,
      '--particle-turn': `${isSnow ? 0 : 360 + Math.random() * 360}deg`,
      '--particle-color': isSnow
        ? '#c5e5ed'
        : ['#edc777', '#74cabb', '#d192a1', '#99b4ec'][index % 4],
    } as CSSProperties;
  });
};
