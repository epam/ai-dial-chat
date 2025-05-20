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
import { CardType } from '@/src/types/talkTo';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { ChangeAgentTabs, MarketplaceTabs } from '@/src/constants/marketplace';
import { SuggestedCard } from '@/src/constants/talkTo';

import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

import { SliderDots } from './SliderDots';
import { TalkToCard } from './TalkToCard';

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

const getStartSingleRowOffset = (screenState: ScreenState) =>
  screenState === ScreenState.SM ? 255 : 217;

const getGridGap = (screenState: ScreenState) =>
  screenState === ScreenState.SM ? 12 : 16;

const getRowsCount = () => {
  const screenState = getScreenState();
  const maxChunksCountConfig = getSliderChunksConfig(screenState);
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

const GAP_BETWEEN_SLIDES = 16;
const calculateTranslateX = (activeSlide: number, clientWidth?: number) => {
  if (!clientWidth) return 'none';

  const offset = activeSlide * (clientWidth + GAP_BETWEEN_SLIDES);

  return `translateX(-${offset}px)`;
};

interface SliderModelsGroupProps {
  modelsGroup: CardType[];
  conversation: Conversation;
  rowsCount: number;
  isMyWorkspace: boolean;
  onSelectModel: (entity: DialAIEntityModel) => void;
  onOpenMarketplaceTab: () => void;
}

const SliderModelsGroup = memo(
  ({
    modelsGroup,
    conversation,
    rowsCount,
    isMyWorkspace,
    onSelectModel,
    onOpenMarketplaceTab,
    ...restProps
  }: SliderModelsGroupProps) => {
    const { t } = useTranslation(Translation.Chat);

    const screenState = useScreenState();

    const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

    const maxChunksCountConfig = getSliderChunksConfig(screenState);

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
                isMyWorkspace={isMyWorkspace}
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

  // Fallback for useLayoutEffect (ex. if mobile keyboard is open)
  useEffect(() => {
    handleResize();
  }, [handleResize]);

  const maxChunksCountConfig = getSliderChunksConfig(screenState);

  const sliderGroups = useMemo(() => {
    return chunk(items, sliderRowsCount * maxChunksCountConfig.cols);
  }, [items, maxChunksCountConfig.cols, sliderRowsCount]);

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
            gap: `${GAP_BETWEEN_SLIDES}px`,
          }}
        >
          {sliderGroups.length ? (
            sliderGroups.map((modelsGroup) => (
              <SliderModelsGroup
                key={modelsGroup.map((model) => model.id).join('.')}
                modelsGroup={modelsGroup}
                conversation={conversation}
                rowsCount={sliderRowsCount}
                isMyWorkspace={isMyWorkspace}
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
      <SliderDots
        activeSlide={activeSlide}
        slidesCount={sliderGroups.length}
        onSetActiveSlide={setActiveSlide}
      />
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
