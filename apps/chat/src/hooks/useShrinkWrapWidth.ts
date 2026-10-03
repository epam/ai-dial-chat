import { RefCallback, useCallback, useLayoutEffect, useState } from 'react';

export const useShrinkWrapWidth = () => {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState<number>();

  const ref: RefCallback<HTMLElement> = useCallback(setElement, [setElement]);

  useLayoutEffect(() => {
    if (!element) {
      setWidth(undefined);
      return;
    }

    const measure = () => {
      const children = Array.from(element.children) as HTMLElement[];

      if (!children.length) {
        return;
      }

      const lineRightEdges = new Map<number, number>();

      children.forEach((child) => {
        const right = child.offsetLeft + child.offsetWidth;

        lineRightEdges.set(
          child.offsetTop,
          Math.max(lineRightEdges.get(child.offsetTop) ?? 0, right),
        );
      });

      setWidth(Math.max(...lineRightEdges.values()));
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(measure);

    Array.from(element.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [element]);

  return { ref, width };
};
