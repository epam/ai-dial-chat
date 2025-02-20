import { IconCaretLeftFilled, IconCaretRightFilled } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useSwipe } from '@/src/hooks/useSwipe';

import {
  isPlaybackConversation,
  isReplayAsIsConversation,
} from '@/src/utils/app/conversation';
import { PseudoModel, isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';

import { NoResultsFound } from '../../Common/NoResultsFound';
import { TalkToCard } from './TalkToCard';

import chunk from 'lodash-es/chunk';
import range from 'lodash-es/range';

const maxChunksCountConfig = {
  [ScreenState.DESKTOP]: {
    cardHeight: 166,
    maxRows: 3,
    cols: 3,
  },
  [ScreenState.TABLET]: {
    cardHeight: 160,
    maxRows: 4,
    cols: 2,
  },
  [ScreenState.MOBILE]: {
    cardHeight: 98,
    maxRows: 5,
    cols: 1,
  },
};

const SLIDER_DOT_SIZE_WITH_GAPS = 24;
const MAX_VISIBLE_SLIDER_DOTS = 7;
const SLIDES_GAP = 16;
const COMMON_GRID_TILES_GAP = 16;
const MOBILE_GRID_TILES_GAP = 12;

const calculateTranslateX = (activeSlide: number, clientWidth?: number) => {
  if (!clientWidth) return 'none';

  const offset = activeSlide * (clientWidth + SLIDES_GAP);

  return `translateX(-${offset}px)`;
};

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

interface SliderModelsGroupProps {
  modelsGroup: DialAIEntityModel[];
  conversation: Conversation;
  screenState: ScreenState;
  rowsCount: number;
  onEdit: (entity: DialAIEntityModel) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel) => void;
  onSelectModel: (entity: DialAIEntityModel) => void;
  onOpenLogs: (entity: DialAIEntityModel) => void;
}

const SliderModelsGroup = ({
  modelsGroup,
  conversation,
  screenState,
  rowsCount,
  onSelectModel,
  ...restProps
}: SliderModelsGroupProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <section
      key={modelsGroup.map((model) => model.id).join('.')}
      className="h-full min-w-full"
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${maxChunksCountConfig[screenState].cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rowsCount}, ${maxChunksCountConfig[screenState].cardHeight}px)`,
          gap:
            screenState === ScreenState.MOBILE
              ? MOBILE_GRID_TILES_GAP
              : COMMON_GRID_TILES_GAP,
        }}
        data-qa="agents"
      >
        {modelsGroup.map((model) => {
          const isNotPseudoModelSelected =
            model.reference === conversation.model.id &&
            !isPlaybackConversation(conversation) &&
            !isReplayAsIsConversation(conversation);
          const isPseudoModelSelected =
            model.reference === PseudoModel.Playback ||
            (model.reference === REPLAY_AS_IS_MODEL &&
              isReplayAsIsConversation(conversation));

          return (
            <TalkToCard
              isSelected={isNotPseudoModelSelected || isPseudoModelSelected}
              conversation={conversation}
              isUnavailableModel={
                !modelsMap[model.reference] &&
                !isPseudoModel(model.id) &&
                model.reference !== REPLAY_AS_IS_MODEL
              }
              disabled={
                isPlaybackConversation(conversation) &&
                model.reference !== PseudoModel.Playback
              }
              key={model.id}
              entity={model}
              onClick={onSelectModel}
              onSelectVersion={onSelectModel}
              {...restProps}
            />
          );
        })}
      </div>
    </section>
  );
};

interface Props {
  conversation: Conversation;
  items: DialAIEntityModel[];
  onEdit: (entity: DialAIEntityModel) => void;
  onDelete: (entity: DialAIEntityModel) => void;
  onPublish: (entity: DialAIEntityModel) => void;
  onSelectModel: (entity: DialAIEntityModel) => void;
  onOpenLogs: (entity: DialAIEntityModel) => void;
}

export const TalkToSlider = ({ conversation, items, ...restProps }: Props) => {
  const sliderRef = useRef<HTMLDivElement>(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [sliderHeight, setSliderHeight] = useState(0);

  const screenState = useScreenState();

  const sliderRowsCount = useMemo(() => {
    const availableRows =
      Math.floor(sliderHeight / maxChunksCountConfig[screenState].cardHeight) ||
      1;

    const finalRows =
      availableRows === 1
        ? availableRows
        : Math.floor(
            (sliderHeight -
              (availableRows - 1) *
                (screenState === ScreenState.MOBILE
                  ? MOBILE_GRID_TILES_GAP
                  : COMMON_GRID_TILES_GAP)) /
              maxChunksCountConfig[screenState].cardHeight,
          ) || 1;

    return finalRows > maxChunksCountConfig[screenState].maxRows
      ? maxChunksCountConfig[screenState].maxRows
      : finalRows;
  }, [screenState, sliderHeight]);

  const sliderGroups = useMemo(() => {
    return chunk(
      items,
      sliderRowsCount * maxChunksCountConfig[screenState].cols,
    );
  }, [items, screenState, sliderRowsCount]);

  const sliderDotsArray = useMemo(() => {
    return range(0, sliderGroups.length);
  }, [sliderGroups.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setActiveSlide((activeSlide) =>
          activeSlide === sliderDotsArray.length - 1
            ? activeSlide
            : activeSlide + 1,
        );
      } else if (e.key === 'ArrowLeft') {
        setActiveSlide((activeSlide) =>
          activeSlide === 0 ? activeSlide : activeSlide - 1,
        );
      }
    },
    [sliderDotsArray.length],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const swipeHandlers = useSwipe({
    onSwipedLeft: () => {
      setActiveSlide((slide) =>
        slide >= sliderGroups.length - 1 ? sliderGroups.length - 1 : slide + 1,
      );
    },
    onSwipedRight: () => {
      setActiveSlide((slide) => (slide === 0 ? 0 : slide - 1));
    },
  });

  useEffect(() => {
    const handleResize = () => {
      if (sliderRef.current) {
        setSliderHeight(sliderRef.current.clientHeight);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (sliderRef.current) {
      resizeObserver.observe(sliderRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (sliderRef.current) {
        setSliderHeight(sliderRef.current.clientHeight);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);

    if (sliderRef.current) {
      resizeObserver.observe(sliderRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!sliderGroups.length) {
      setActiveSlide(0);
    } else if (activeSlide !== 0 && activeSlide > sliderGroups.length - 1) {
      setActiveSlide(sliderGroups.length - 1);
    }
  }, [activeSlide, sliderGroups]);

  const excessDots = sliderDotsArray.length - MAX_VISIBLE_SLIDER_DOTS;
  const maxDotsTranslate = Math.max(0, excessDots * SLIDER_DOT_SIZE_WITH_GAPS);
  const translateXValue = Math.max(
    0,
    Math.min(maxDotsTranslate, (activeSlide - 3) * SLIDER_DOT_SIZE_WITH_GAPS),
  );
  const isMobileOrTablet =
    screenState === ScreenState.MOBILE || screenState === ScreenState.TABLET;

  return (
    <>
      <div
        ref={sliderRef}
        className="flex h-[428px] max-h-[428px] w-full flex-col overflow-y-auto overflow-x-hidden md:h-[688px] md:max-h-[688px] xl:h-[530px] xl:max-h-[530px]"
      >
        <div
          {...swipeHandlers}
          className={classNames(
            'flex size-full',
            sliderGroups.length && 'transition duration-1000 ease-out',
          )}
          style={{
            transform: calculateTranslateX(
              activeSlide,
              sliderRef.current?.clientWidth,
            ),
            gap: `${SLIDES_GAP}px`,
          }}
        >
          {sliderGroups.length ? (
            sliderGroups.map((modelsGroup) => (
              <SliderModelsGroup
                key={modelsGroup.map((model) => model.id).join('.')}
                modelsGroup={modelsGroup}
                conversation={conversation}
                screenState={screenState}
                rowsCount={sliderRowsCount}
                {...restProps}
              />
            ))
          ) : (
            <div className="flex size-full items-center justify-center">
              <NoResultsFound />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex w-full items-center justify-center md:justify-end">
        <div className="flex flex-col items-center md:h-5 md:w-1/2 md:flex-row md:justify-between">
          <div className="relative flex items-center gap-4 md:-translate-x-1/2">
            {sliderDotsArray.length <= 1 &&
              screenState === ScreenState.MOBILE && (
                <span className="h-[18px] bg-transparent"></span>
              )}
            {sliderDotsArray.length > 1 && (
              <>
                {!isMobileOrTablet && (
                  <button
                    onClick={() =>
                      setActiveSlide((activeSlide) =>
                        activeSlide === 0 ? activeSlide : activeSlide - 1,
                      )
                    }
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
                          onClick={() => setActiveSlide(slideNumber)}
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
                    onClick={() =>
                      setActiveSlide((activeSlide) =>
                        activeSlide === sliderDotsArray.length - 1
                          ? activeSlide
                          : activeSlide + 1,
                      )
                    }
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
    </>
  );
};
