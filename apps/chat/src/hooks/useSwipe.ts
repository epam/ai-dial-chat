import { useCallback, useState } from 'react';

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
  const [isPointerDown, setIsPointerDown] = useState(false);

  const onStart = useCallback((e: SwipeEvent) => {
    if ('touches' in e) {
      setStartX(e.targetTouches[0].clientX);
    } else {
      setStartX(e.clientX);
    }

    setEndX(undefined);
    setIsPointerDown(true);
  }, []);

  const onMove = useCallback(
    (e: SwipeEvent) => {
      if ('touches' in e) {
        setEndX(e.targetTouches[0].clientX);
      } else if (isPointerDown) {
        setEndX(e.clientX);
      }
    },
    [isPointerDown],
  );

  const onEnd = useCallback(() => {
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
    setIsPointerDown(false);
  }, [endX, onSwipedLeft, onSwipedRight, startX]);

  return {
    onTouchStart: onStart,
    onTouchMove: onMove,
    onTouchEnd: onEnd,
    onPointerDown: onStart,
    onPointerMove: onMove,
    onPointerUp: onEnd,
  };
};
