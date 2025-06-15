import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

interface Props {
  children: React.ReactNode;
  separatorRowId: number;
  rowsHeight: number;
  className?: string;
}

export interface AgentsListWrapperRef {
  parentRef: React.RefObject<HTMLDivElement>;
  suggestedRowRef: React.RefObject<HTMLSpanElement>;
}

export const AgentsListWrapper = forwardRef<AgentsListWrapperRef, Props>(
  ({ children, separatorRowId, rowsHeight, className }, ref) => {
    const { t } = useTranslation(Translation.Marketplace);
    const router = useRouter();
    const parentRef = useRef<HTMLDivElement>(null);
    const suggestedRowRef = useRef<HTMLSpanElement>(null);

    // Using useImperativeHandle to expose internal refs (parentRef and suggestedRowRef)
    // to the parent component. This allows the parent to control scrolling and positioning
    // of elements within this component.
    //
    // parentRef: Provides a reference to the virtual list container that manages scrolling.
    // suggestedRowRef: Provides a reference to the element representing the row text (separator).

    const scrollToTop = useCallback(() => {
      parentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        parentRef,
        suggestedRowRef,
        scrollToTop,
      }),
      [scrollToTop],
    );

    useEffect(() => {
      const handleRouteChange = () => {
        scrollToTop();
      };

      router.events.on('routeChangeComplete', handleRouteChange);

      scrollToTop();

      return () => {
        router.events.off('routeChangeComplete', handleRouteChange);
      };
    }, [router.events, scrollToTop]);

    return (
      <section
        ref={parentRef}
        data-qa="agents-section"
        className={classNames(
          'relative flex grow overflow-y-auto overflow-x-hidden px-3 md:px-5 xl:px-16',
          className,
        )}
      >
        {separatorRowId >= 0 && (
          <span
            ref={suggestedRowRef}
            className="absolute flex max-w-full items-center px-3 text-xl"
            style={{
              height: `${rowsHeight}px`,
              top: `${separatorRowId * rowsHeight}px`,
            }}
            data-qa="marketplace-suggestions-label"
          >
            {t('Suggested results from DIAL Marketplace')}
          </span>
        )}
        {children}
      </section>
    );
  },
);
AgentsListWrapper.displayName = 'AgentsListWrapper';
