import { useState } from 'react';

type TouchEvent<T = Element> = React.TouchEvent<T>;

export const useMobileSwipe = ({
  onSwipedLeft,
  onSwipedRight,
}: {
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
}) => {
  const [touchStart, setTouchStart] = useState<number>();
  const [touchEnd, setTouchEnd] = useState<number>();

  const onTouchStart = (e: TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(undefined);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const minDistance = 50;

    if (distance > minDistance) {
      onSwipedLeft();
    }

    if (distance < -minDistance) {
      onSwipedRight();
    }

    setTouchStart(undefined);
    setTouchEnd(undefined);
  };

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
};
