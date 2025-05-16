import { IconCaretLeftFilled, IconCaretRightFilled } from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useSwipe } from '@/src/hooks/useSwipe';
import { useTranslation } from '@/src/hooks/useTranslation';
import { useWindowResizeEvent } from '@/src/hooks/useWindowResizeEvent';

import {
  isPlaybackConversation,
  isReplayAsIsConversation,
} from '@/src/utils/app/conversation';
import { getScreenState } from '@/src/utils/app/mobile';
import { PseudoModel, isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { ChangeAgentTabs, MarketplaceTabs } from '@/src/constants/marketplace';

import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

import { TalkToCard } from './TalkToCard';

import chunk from 'lodash-es/chunk';
import range from 'lodash-es/range';

const DEFAULT_MAX_CHUNKS_COUNT_CONFIG = {
  cardHeight: 166,
  maxRows: 3,
  cols: 3,
};
const TABLET_MAX_CHUNKS_COUNT_CONFIG = {
  cardHeight: 160,
  maxRows: 4,
  cols: 2,
};
const MOBILE_MAX_CHUNKS_COUNT_CONFIG = {
  cardHeight: 98,
  maxRows: 5,
  cols: 1,
};
const MAX_CHUNKS_COUNT_CONFIG = {
  [ScreenState.MD]: TABLET_MAX_CHUNKS_COUNT_CONFIG,
  [ScreenState.SM]: MOBILE_MAX_CHUNKS_COUNT_CONFIG,
};
const getMaxChunksCountConfig = (screenState: ScreenState) => {
  if (screenState === ScreenState.SM || screenState === ScreenState.MD) {
    return MAX_CHUNKS_COUNT_CONFIG[screenState];
  }

  return DEFAULT_MAX_CHUNKS_COUNT_CONFIG;
};

const DEFAULT_SINGLE_ROW_OFFSET = 217;
const MOBILE__SINGLE_ROW_OFFSET = 255;
const getStartSingleRowOffset = (screenState: ScreenState) =>
  screenState === ScreenState.SM
    ? MOBILE__SINGLE_ROW_OFFSET
    : DEFAULT_SINGLE_ROW_OFFSET;

const SLIDER_DOT_SIZE_WITH_GAPS = 24;
const MAX_VISIBLE_SLIDER_DOTS = 7;
const SLIDES_GAP = 16;

const getGridGap = (screenState: ScreenState) =>
  screenState === ScreenState.SM ? 12 : 16;

const getRowsCount = () => {
  const screenState = getScreenState();
  const maxChunksCountConfig = getMaxChunksCountConfig(screenState);
  const cardHeight = maxChunksCountConfig.cardHeight;
  const gap = getGridGap(screenState);
  const startSingleRowOffset = getStartSingleRowOffset(screenState);
  let currentHeight = startSingleRowOffset + cardHeight * 2 + gap;
  let currentRows = 1;

  while (
    currentHeight < window.innerHeight &&
    currentRows + 1 <= maxChunksCountConfig.maxRows
  ) {
    currentRows++;
    currentHeight += cardHeight + gap;
  }

  return currentRows;
};

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
  modelsGroup: CardType[];
  conversation: Conversation;
  rowsCount: number;
  onSelectModel: (entity: DialAIEntityModel) => void;
  onOpenMarketplaceTab: () => void;
}

const SliderModelsGroup = memo(
  ({
    modelsGroup,
    conversation,
    rowsCount,
    onSelectModel,
    onOpenMarketplaceTab,
    ...restProps
  }: SliderModelsGroupProps) => {
    const { t } = useTranslation(Translation.Chat);

    const screenState = useScreenState();

    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

    const maxChunksCountConfig = getMaxChunksCountConfig(screenState);

    return (
      <section
        key={modelsGroup.map((model) => model.reference).join('.')}
        className="h-full min-w-full"
        data-qa="agents-section"
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${maxChunksCountConfig.cols}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rowsCount}, ${maxChunksCountConfig.cardHeight}px)`,
            gap: getGridGap(screenState),
          }}
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

            if (model === SuggestedCard) {
              return (
                <div
                  className="flex size-full cursor-pointer flex-col items-center justify-center gap-3 rounded-md border border-primary hover:bg-layer-3"
                  onClick={onOpenMarketplaceTab}
                  key={SuggestedCard.id}
                >
                  <h3 className="text-base">
                    {t("Couldn't find what you need?")}
                  </h3>
                  <SuggestionButton />
                </div>
              );
            }

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
                entity={model as DialAIEntityModel}
                onClick={onSelectModel}
                onSelectVersion={onSelectModel}
                {...restProps}
              />
            );
          })}
        </div>
      </section>
    );
  },
);
SliderModelsGroup.displayName = 'SliderModelsGroup';

export const SuggestedCard = {
  id: 'suggested',
  reference: 'suggested',
};

export type CardType = DialAIEntityModel | typeof SuggestedCard;

interface Props {
  conversation: Conversation;
  items: CardType[];
  isMyWorkspace: boolean;
  isSearchMode: boolean;
  searchTerm: string;
  onSelectModel: (entity: DialAIEntityModel) => void;
  onOpenMarketplaceTab: () => void;
}

export const TalkToSlider = ({
  conversation,
  items,
  isMyWorkspace,
  searchTerm,
  onOpenMarketplaceTab,
  ...restProps
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const sliderRef = useRef<HTMLDivElement>(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [sliderRowsCount, setSliderRowsCount] = useState(1);
  const [resizeTime, setResizeTime] = useState(Date.now());

  const screenState = useScreenState();

  const handleResize = useCallback(() => {
    setSliderRowsCount(getRowsCount());
    setResizeTime(Date.now());
  }, []);
  useWindowResizeEvent(handleResize);

  // Should calculate height before render
  useLayoutEffect(() => {
    handleResize();
  }, [handleResize]);

  const maxChunksCountConfig = getMaxChunksCountConfig(screenState);

  const sliderGroups = useMemo(() => {
    return chunk(items, sliderRowsCount * maxChunksCountConfig.cols);
  }, [items, maxChunksCountConfig.cols, sliderRowsCount]);

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
    if (!sliderGroups.length) {
      setActiveSlide(0);
    } else if (activeSlide !== 0 && activeSlide > sliderGroups.length - 1) {
      setActiveSlide(sliderGroups.length - 1);
    }
  }, [activeSlide, sliderGroups]);

  useEffect(() => {
    setActiveSlide(0);
  }, [searchTerm, isMyWorkspace]);

  const excessDots = sliderDotsArray.length - MAX_VISIBLE_SLIDER_DOTS;
  const maxDotsTranslate = Math.max(0, excessDots * SLIDER_DOT_SIZE_WITH_GAPS);
  const translateXValue = Math.max(
    0,
    Math.min(maxDotsTranslate, (activeSlide - 3) * SLIDER_DOT_SIZE_WITH_GAPS),
  );
  const isMobileOrTablet =
    screenState === ScreenState.SM || screenState === ScreenState.MD;
  const gridGap = getGridGap(screenState);
  const resizeDeltaTime = Date.now() - resizeTime;

  return (
    <>
      <div
        ref={sliderRef}
        className="flex max-h-[538px] w-full flex-col overflow-y-auto overflow-x-hidden md:max-h-[688px] xl:max-h-[530px]"
        style={{
          height: `${
            sliderRowsCount * (maxChunksCountConfig.cardHeight + gridGap) -
            gridGap
          }px`,
        }}
      >
        <div
          {...swipeHandlers}
          className={classNames(
            'flex size-full',
            sliderGroups.length && 'transition ease-out',
            resizeDeltaTime < 50 ? 'duration-0' : 'duration-1000',
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
                rowsCount={sliderRowsCount}
                onOpenMarketplaceTab={onOpenMarketplaceTab}
                {...restProps}
              />
            ))
          ) : (
            <div className="flex size-full items-center justify-center">
              <NoResultsFound
                additionalText={
                  isMyWorkspace
                    ? t(` in ${ChangeAgentTabs[MarketplaceTabs.MY_WORKSPACE]}`)
                    : ''
                }
              >
                {isMyWorkspace && (
                  <SuggestionButton onClick={onOpenMarketplaceTab} />
                )}
              </NoResultsFound>
            </div>
          )}
        </div>
      </div>
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

interface SuggestionButtonProps {
  onClick?: () => void;
}

const SuggestionButton = ({ onClick }: SuggestionButtonProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <button className="text-accent-primary" onClick={onClick}>
      {t(`See results from ${ChangeAgentTabs[MarketplaceTabs.HOME]}`)}
    </button>
  );
};
