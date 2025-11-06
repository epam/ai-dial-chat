import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSearchParams } from 'next/navigation';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useSwipe } from '@/src/hooks/useSwipe';
import { useWindowResizeEvent } from '@/src/hooks/useWindowResizeEvent';

import { getScreenState } from '@/src/utils/app/mobile';
import { updateQueryParamWithReplace } from '@/src/utils/app/url/query-params';

import { ScreenState } from '@/src/types/common';

import { SliderDots } from './SliderDots';

import chunk from 'lodash-es/chunk';

const DEFAULT_SLIDER_CHUNKS_CONFIG = {
  cardHeight: 166,
  maxRows: 3,
  cols: 3,
};
const TABLET_SLIDER_CHUNKS_CONFIG = {
  cardHeight: 160,
  maxRows: 4,
  cols: 2,
};
const MOBILE_SLIDER_CHUNKS_CONFIG = {
  cardHeight: 98,
  maxRows: 5,
  cols: 1,
};
const SLIDER_CHUNKS_CONFIG = {
  [ScreenState.MD]: TABLET_SLIDER_CHUNKS_CONFIG,
  [ScreenState.SM]: MOBILE_SLIDER_CHUNKS_CONFIG,
};
const getSliderChunksConfig = (screenState: ScreenState) =>
  screenState === ScreenState.SM || screenState === ScreenState.MD
    ? SLIDER_CHUNKS_CONFIG[screenState]
    : DEFAULT_SLIDER_CHUNKS_CONFIG;

const getGridGap = (screenState: ScreenState) =>
  screenState === ScreenState.SM ? 12 : 16;

const GAP_BETWEEN_SLIDES = 16;
const calculateTranslateX = (activeSlide: number, clientWidth?: number) => {
  if (!clientWidth) return 'none';
  const offset = activeSlide * (clientWidth + GAP_BETWEEN_SLIDES);
  return `translateX(-${offset}px)`;
};

const shouldRenderSlide = (
  slideIndex: number,
  activeSlide: number,
  prevActiveSlide: number,
) => {
  const minIndex = Math.min(activeSlide, prevActiveSlide);
  const maxIndex = Math.max(activeSlide, prevActiveSlide);
  return slideIndex >= minIndex - 1 && slideIndex <= maxIndex + 1;
};

const sliderActiveSlideQueryParam = 'sliderActiveSlide';
const sliderPrevActiveSlideQueryParam = 'sliderPrevActiveSlide';

interface SliderProps<T, P> {
  items: T[];
  SliderItem: FC<P & { groupItem: T }>;
  notFound: ReactNode;
  itemProps: P;
  sliderResetDependencies?: unknown[];
  modalHeaderHeight?: number;
  modalFooterHeight?: number;
  sliderDotsClassName?: string;
  saveSliderStateInURL?: boolean;
}

export const SliderGrid = <T extends { id: string }, P>({
  items,
  SliderItem,
  notFound,
  itemProps,
  sliderResetDependencies,
  modalHeaderHeight = 0,
  modalFooterHeight = 0,
  sliderDotsClassName,
  saveSliderStateInURL = false,
}: SliderProps<T, P>) => {
  const searchParams = useSearchParams();

  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const [activeSlide, setActiveSlide] = useState(
    searchParams.get(sliderActiveSlideQueryParam)
      ? parseInt(searchParams.get(sliderActiveSlideQueryParam) ?? '0')
      : 0,
  );
  const [prevActiveSlide, setPrevActiveSlide] = useState(
    searchParams.get(sliderPrevActiveSlideQueryParam)
      ? parseInt(searchParams.get(sliderPrevActiveSlideQueryParam) ?? '0')
      : 0,
  );
  const [sliderRowsCount, setSliderRowsCount] = useState(1);
  const [resizeTime, setResizeTime] = useState(0);

  const screenState = useScreenState();

  const handleResize = useCallback(() => {
    if (!sliderRef.current || !footerRef.current || !containerRef.current)
      return;

    const currentScreenState = getScreenState();

    const config = getSliderChunksConfig(currentScreenState);
    const gap = getGridGap(currentScreenState);

    const internalFooterHeight = footerRef.current.offsetHeight;

    const availableHeight =
      window.innerHeight -
      modalHeaderHeight -
      modalFooterHeight -
      internalFooterHeight -
      config.cardHeight;

    const calculatedRows = Math.floor(
      (availableHeight + gap) / (config.cardHeight + gap),
    );

    const finalRows = Math.max(1, Math.min(calculatedRows, config.maxRows));

    setSliderRowsCount(finalRows);
    setResizeTime(Date.now());
  }, [modalFooterHeight, modalHeaderHeight]);

  useWindowResizeEvent(handleResize);

  useLayoutEffect(() => {
    handleResize();
  }, [handleResize]);

  const maxChunksCountConfig = getSliderChunksConfig(screenState);
  const gridGap = getGridGap(screenState);

  const sliderGroups = useMemo(() => {
    return chunk(items, sliderRowsCount * maxChunksCountConfig.cols);
  }, [items, maxChunksCountConfig.cols, sliderRowsCount]);

  const handleSetActiveSlide = useCallback(
    (slide: number) => {
      setPrevActiveSlide(activeSlide);
      setActiveSlide(slide);

      if (saveSliderStateInURL) {
        updateQueryParamWithReplace(
          sliderActiveSlideQueryParam,
          slide.toString(),
        );
        updateQueryParamWithReplace(
          sliderPrevActiveSlideQueryParam,
          activeSlide.toString(),
        );
      }
    },
    [activeSlide, saveSliderStateInURL],
  );

  const handleSwipedRight = useCallback(() => {
    handleSetActiveSlide(
      activeSlide >= sliderGroups.length - 1
        ? sliderGroups.length - 1
        : activeSlide + 1,
    );
  }, [activeSlide, sliderGroups, handleSetActiveSlide]);
  const handleSwipedLeft = useCallback(() => {
    handleSetActiveSlide(activeSlide === 0 ? 0 : activeSlide - 1);
  }, [activeSlide, handleSetActiveSlide]);
  const swipeHandlers = useSwipe(handleSwipedRight, handleSwipedLeft);

  useEffect(() => {
    let newActive = activeSlide;
    let newPrev = prevActiveSlide;

    if (!sliderGroups.length) {
      newActive = 0;
      newPrev = 0;
    } else if (activeSlide > sliderGroups.length - 1) {
      newActive = sliderGroups.length - 1;
      newPrev = sliderGroups.length - 1;
    } else {
      return;
    }

    setActiveSlide(newActive);
    setPrevActiveSlide(newPrev);

    if (saveSliderStateInURL) {
      updateQueryParamWithReplace(
        sliderActiveSlideQueryParam,
        newActive.toString(),
      );
      updateQueryParamWithReplace(
        sliderPrevActiveSlideQueryParam,
        newPrev.toString(),
      );
    }
  }, [activeSlide, prevActiveSlide, sliderGroups, saveSliderStateInURL]);

  useEffect(() => {
    if (!sliderResetDependencies) {
      return;
    }

    setActiveSlide(0);
    setPrevActiveSlide(0);

    if (saveSliderStateInURL) {
      updateQueryParamWithReplace(sliderActiveSlideQueryParam, '0');
      updateQueryParamWithReplace(sliderPrevActiveSlideQueryParam, '0');
    }
  }, [sliderResetDependencies, saveSliderStateInURL]);

  const resizeDeltaTime = Date.now() - resizeTime;

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <div
        ref={sliderRef}
        className="flex w-full flex-1 items-center overflow-hidden"
        style={{
          minHeight: `${
            sliderRowsCount * (maxChunksCountConfig.cardHeight + gridGap) -
            gridGap
          }px`,
        }}
      >
        <div
          {...swipeHandlers}
          className={classNames(
            'flex size-full transition-transform ease-out',
            resizeDeltaTime < 50 ? 'duration-0' : 'duration-1000',
          )}
          style={{
            transform: calculateTranslateX(
              activeSlide,
              sliderRef.current?.clientWidth,
            ),
            gap: `${GAP_BETWEEN_SLIDES}px`,
          }}
        >
          {sliderGroups.length ? (
            sliderGroups.map((sliderGroup, index) => (
              <section
                key={sliderGroup.map((groupItem) => groupItem.id).join('.')}
                className="h-full min-w-full"
                data-qa="agents-section"
              >
                {shouldRenderSlide(index, activeSlide, prevActiveSlide) && (
                  <div
                    className="grid h-full"
                    style={{
                      gridTemplateColumns: `repeat(${maxChunksCountConfig.cols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${sliderRowsCount}, ${maxChunksCountConfig.cardHeight}px)`,
                      gap: gridGap,
                    }}
                  >
                    {sliderGroup.map((groupItem) => (
                      <SliderItem
                        key={groupItem.id}
                        groupItem={groupItem}
                        {...itemProps}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))
          ) : (
            <div className="flex size-full items-center justify-center">
              {notFound}
            </div>
          )}
        </div>
      </div>
      <div ref={footerRef}>
        <SliderDots
          activeSlide={activeSlide}
          slidesCount={sliderGroups.length}
          onSetActiveSlide={handleSetActiveSlide}
          className={sliderDotsClassName}
        />
      </div>
    </div>
  );
};
