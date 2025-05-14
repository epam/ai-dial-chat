import { useCallback, useEffect, useRef, useState } from 'react';

import { getScreenState } from '@/src/utils/app/mobile';

import { useDocumentBody } from './useDocumentBody';
import { useResizeObserver } from './useResizeObserver';

export const useScreenState = () => {
  const [screenState, setScreenState] = useState(getScreenState());

  const handleResize = useCallback(() => setScreenState(getScreenState()), []);
  const bodyRef = useDocumentBody();
  useResizeObserver(bodyRef.current, handleResize);

  return screenState;
};
