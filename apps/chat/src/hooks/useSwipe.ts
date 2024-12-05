import { useState } from 'react';

type SwipeEvent<T = Element> = React.TouchEvent<T> | React.PointerEvent<T>;

export const useSwipe = ({
  onSwipedLeft,
  onSwipedRight,
}: {
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
}) => {
  const [startX, setStartX] = useState<number>();
  const [endX, setEndX] = useState<number>();

  const onStart = (e: SwipeEvent) => {
    if ('touches' in e) {
      setStartX(e.targetTouches[0].clientX);
    } else {
      setStartX(e.clientX);
    }
    setEndX(undefined);
  };

  const onMove = (e: SwipeEvent) => {
    if ('touches' in e) {
      setEndX(e.targetTouches[0].clientX);
    } else {
      setEndX(e.clientX);
    }
  };

  const onEnd = () => {
    if (startX === undefined || endX === undefined) return;

    const distance = startX - endX;
    const minDistance = 50;

    if (distance > minDistance) {
      onSwipedLeft();
    }

    if (distance < -minDistance) {
      onSwipedRight();
    }

    setStartX(undefined);
    setEndX(undefined);
  };

  return {
    onTouchStart: onStart,
    onTouchMove: onMove,
    onTouchEnd: onEnd,
    onPointerDown: onStart,
    onPointerMove: onMove,
    onPointerUp: onEnd,
  };
};
