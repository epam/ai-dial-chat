/** Pull one idle host control toward the flipper and restore it on cleanup. */
export const borrowPenguinStarElement = (
  element: HTMLElement,
  from: DOMRect,
  to: [number, number],
): (() => void) => {
  if (typeof element.animate !== 'function') return () => undefined;
  const dx = to[0] - (from.left + from.width / 2);
  const dy = to[1] - (from.top + from.height / 2);
  let animation: Animation;
  try {
    animation = element.animate(
      [
        {
          offset: 0,
          transform: 'translate(0px, 0px) rotate(0deg) scale(1)',
          opacity: 1,
        },
        {
          offset: 0.22,
          transform: `translate(${dx * 0.24}px, ${dy * 0.18 - 18}px) rotate(-8deg) scale(0.94)`,
          opacity: 1,
        },
        {
          offset: 0.72,
          transform: `translate(${dx * 0.86}px, ${dy * 0.8 - 12}px) rotate(20deg) scale(0.55)`,
          opacity: 1,
        },
        {
          offset: 0.88,
          transform: `translate(${dx}px, ${dy}px) rotate(65deg) scale(0.28)`,
          opacity: 1,
        },
        {
          offset: 1,
          transform: `translate(${dx}px, ${dy}px) rotate(80deg) scale(0.08)`,
          opacity: 0,
        },
      ],
      {
        duration: 1600,
        fill: 'forwards',
        easing: 'linear',
      },
    );
  } catch {
    return () => undefined;
  }
  let cancelled = false;
  return () => {
    if (cancelled) return;
    cancelled = true;
    try {
      animation.cancel();
    } catch {
      /* Failed WAAPI cleanup must not hold the scene open. */
    }
  };
};
