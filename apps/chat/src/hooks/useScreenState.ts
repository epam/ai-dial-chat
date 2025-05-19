import { useCallback, useState } from 'react';

import { getScreenState } from '@/src/utils/app/mobile';

import { useWindowResizeEvent } from './useWindowResizeEvent';

export const useScreenState = () => {
  const [screenState, setScreenState] = useState(getScreenState());

  const handleResize = useCallback(() => setScreenState(getScreenState()), []);
  useWindowResizeEvent(handleResize);

  return screenState;
};
