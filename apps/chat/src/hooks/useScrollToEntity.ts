import { RefObject, useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { useAppSelector } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

interface ScrollToEntityProps {
  entityId: string;
  elementRef: RefObject<HTMLElement>;
}

export const useScrollToEntity = ({
  entityId,
  elementRef,
}: ScrollToEntityProps) => {
  const dispatch = useDispatch();
  const scrollToEntityId = useAppSelector(UISelectors.selectScrollToEntityId);

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
