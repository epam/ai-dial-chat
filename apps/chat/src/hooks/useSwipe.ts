import { useCallback, useState } from 'react';

import isNumber from 'lodash-es/isNumber';

type SwipeHandler = () => void;

export const useSwipe = (
  onSwipedLeft: SwipeHandler,
  onSwipedRight: SwipeHandler,
) => {
  const [startX, setStartX] = useState<number>();

  const onStart = useCallback((e: React.TouchEvent) => {
    setStartX(e.targetTouches[0].clientX);
  }, []);

  const onEnd = useCallback(
    (e: React.TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      if (!isNumber(startX) || !isNumber(endX)) return;

      const distance = startX - endX;
      const minDistance = 50;

      if (distance > minDistance) {
        onSwipedLeft();
      }

      if (distance < -minDistance) {
        onSwipedRight();
      }

      setStartX(undefined);
    },
    [onSwipedLeft, onSwipedRight, startX],
  );

  return {
    onTouchStart: onStart,
    onTouchEnd: onEnd,
  };
};
