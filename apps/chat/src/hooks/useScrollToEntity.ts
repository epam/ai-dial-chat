import { RefObject, useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { UIActions } from '../store/ui/ui.reducers';

interface ScrollToEntityProps {
  entityId: string;
  scrollToEntityId: string | undefined;
  elementRef: RefObject<HTMLElement>;
}

export const useScrollToEntity = ({
  entityId,
  scrollToEntityId,
  elementRef,
}: ScrollToEntityProps) => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (scrollToEntityId === entityId && elementRef.current) {
      const intersectionObserver = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) {
          elementRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
        dispatch(UIActions.setScrollToEntityId());
      });
      intersectionObserver.observe(elementRef.current);
      return () => intersectionObserver.disconnect();
    }
  }, [entityId, dispatch, scrollToEntityId, elementRef]);
};
