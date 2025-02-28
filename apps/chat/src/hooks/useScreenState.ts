import { useEffect, useState } from 'react';

import { getScreenState } from '../utils/app/mobile';

export const useScreenState = (containerRef?: HTMLElement | null) => {
  const [screenState, setScreenState] = useState(
    getScreenState(containerRef ?? undefined),
  );

  useEffect(() => {
    const handleResize = () =>
      setScreenState(getScreenState(containerRef ?? undefined));
    const resizeObserver = new ResizeObserver(handleResize);

    resizeObserver.observe(containerRef ?? document.body);

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  return screenState;
};
