import { IconCaretLeftFilled, IconCaretRightFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';

import { ScreenState } from '@/src/types/common';

import range from 'lodash-es/range';

const getDotSizeClass = (
  slideNumber: number,
  activeSlide: number,
  slidesCount: number,
) => {
  if (slideNumber === activeSlide) {
    return 'h-2 w-8';
  }

  if (slidesCount < 7) {
    return 'size-2';
  }

  const offsetActive = activeSlide - slideNumber;
  const offsetLast = slidesCount - activeSlide;

  if (
    (offsetActive === 3 && activeSlide > 2 && offsetLast > 3) ||
    (offsetLast === 3 && slideNumber < activeSlide - 3) ||
    (offsetLast === 2 && slideNumber < activeSlide - 4) ||
    (offsetLast === 1 && slideNumber < activeSlide - 5) ||
    (activeSlide <= 3 && slideNumber === 6) ||
    (activeSlide > 3 && slideNumber > activeSlide + 2)
  ) {
    return 'size-1';
  }

  if (
    (offsetActive === 2 && activeSlide > 1 && offsetLast > 3) ||
    (offsetLast === 3 && slideNumber < activeSlide - 2) ||
    (offsetLast === 2 && slideNumber < activeSlide - 3) ||
    (offsetLast === 1 && slideNumber < activeSlide - 4) ||
    (activeSlide <= 3 && slideNumber === 5) ||
    (activeSlide > 3 && slideNumber > activeSlide + 1)
  ) {
    return 'size-1.5';
  }

  return 'size-2';
};

const SLIDER_DOT_SIZE_WITH_GAPS = 24;
const MAX_VISIBLE_SLIDER_DOTS = 7;

interface Props {
  activeSlide: number;
  slidesCount: number;
  onSetActiveSlide: (slide: number) => void;
}

export const SliderDots: React.FC<Props> = ({
  activeSlide,
  slidesCount,
  onSetActiveSlide,
}) => {
  const screenState = useScreenState();

  const isMobileOrTablet =
    screenState === ScreenState.SM || screenState === ScreenState.MD;
  const sliderDotsArray = useMemo(() => {
    return range(0, slidesCount);
  }, [slidesCount]);
  const excessDots = sliderDotsArray.length - MAX_VISIBLE_SLIDER_DOTS;
  const maxDotsTranslate = Math.max(0, excessDots * SLIDER_DOT_SIZE_WITH_GAPS);
  const translateXValue = Math.max(
    0,
    Math.min(maxDotsTranslate, (activeSlide - 3) * SLIDER_DOT_SIZE_WITH_GAPS),
  );

  const handleClickRightArrow = useCallback(() => {
    onSetActiveSlide(
      activeSlide === sliderDotsArray.length - 1
        ? activeSlide
        : activeSlide + 1,
    );
  }, [activeSlide, onSetActiveSlide, sliderDotsArray.length]);

  const handleClickLeftArrow = useCallback(() => {
    onSetActiveSlide(activeSlide === 0 ? activeSlide : activeSlide - 1);
  }, [activeSlide, onSetActiveSlide]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleClickRightArrow();
      } else if (e.key === 'ArrowLeft') {
        handleClickLeftArrow();
      }
    },
    [handleClickLeftArrow, handleClickRightArrow],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="mt-4 flex w-full items-center justify-center md:justify-end">
      <div className="flex flex-col items-center md:h-5 md:w-1/2 md:flex-row md:justify-between">
        <div className="relative flex items-center gap-4 md:-translate-x-1/2">
          {sliderDotsArray.length <= 1 && screenState === ScreenState.SM && (
            <span className="h-[18px] bg-transparent"></span>
          )}
          {sliderDotsArray.length > 1 && (
            <>
              {!isMobileOrTablet && (
                <button
                  onClick={handleClickLeftArrow}
                  data-qa="slider-dot-arrow-prev"
                  disabled={activeSlide === 0}
                  className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:hover:text-secondary"
                >
                  <IconCaretLeftFilled size={18} />
                </button>
              )}
              <div className="flex max-w-[176px] overflow-hidden">
                <div
                  className="flex items-center gap-4  transition-all duration-200"
                  style={{
                    transform: `translateX(-${translateXValue}px)`,
                  }}
                >
                  {sliderDotsArray.map((slideNumber) => {
                    return (
                      <div
                        key={slideNumber}
                        data-qa={`slider-dot-${slideNumber}`}
                        onClick={() => onSetActiveSlide(slideNumber)}
                        className="flex min-w-2 items-center justify-center"
                      >
                        <button
                          className={classNames(
                            'rounded-full bg-controls-disable transition-all duration-200',
                            getDotSizeClass(
                              slideNumber,
                              activeSlide,
                              sliderDotsArray.length,
                            ),
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              {!isMobileOrTablet && (
                <button
                  onClick={handleClickRightArrow}
                  data-qa="slider-dot-arrow-next"
                  disabled={activeSlide === sliderDotsArray.length - 1}
                  className="text-secondary hover:text-accent-primary disabled:cursor-not-allowed disabled:hover:text-secondary"
                >
                  <IconCaretRightFilled size={18} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
