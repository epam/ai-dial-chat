import { useCallback, useState } from 'react';

import { getScreenState } from '@/src/utils/app/mobile';

import { useResizeObserver } from './useResizeObserver';

export const useScreenState = () => {
  const [screenState, setScreenState] = useState(getScreenState());

  const handleResize = useCallback(() => setScreenState(getScreenState()), []);

  useResizeObserver(document.body, handleResize);

  return screenState;
};
