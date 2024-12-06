import { useEffect, useState } from 'react';

import { getScreenState } from '../utils/app/mobile';

export const useScreenState = () => {
  const [screenState, setScreenState] = useState(getScreenState());

  useEffect(() => {
    const handleResize = () => setScreenState(getScreenState());
    const resizeObserver = new ResizeObserver(handleResize);

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  }, []);

  return screenState;
};
