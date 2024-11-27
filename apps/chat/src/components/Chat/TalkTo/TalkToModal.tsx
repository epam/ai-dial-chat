import {
  IconCaretLeftFilled,
  IconCaretRightFilled,
  IconSearch,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useSwipe } from '@/src/hooks/useSwipe';

import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { ApiUtils, PseudoModel, isPseudoModel } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { MarketplaceQueryParams } from '@/src/constants/marketplace';

import Modal from '@/src/components/Common/Modal';

import { TalkToCard } from './TalkToCard';

import chunk from 'lodash-es/chunk';
import orderBy from 'lodash-es/orderBy';
import range from 'lodash-es/range';

interface Props {
  conversation: Conversation;
  onClose: () => void;
  onChangeModel: (conversation: Conversation, modelReference: string) => void;
}

const GRID_GAP = 16;

const calculateTranslateX = (activeSlide: number, clientWidth?: number) => {
  if (!clientWidth) return 'none';

  const offset = activeSlide * (clientWidth + GRID_GAP);

  return `translateX(-${offset}px)`;
};

export const TalkToModal = ({
  conversation,
  onClose,
  onChangeModel,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const router = useRouter();

  const allModels = useAppSelector(ModelsSelectors.selectModels);
  const installedModelIds = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);

  const sliderRef = useRef<HTMLDivElement>(null);

  const allModelsRefs = allModels.map((model) => model.reference);

  const sliderGroups = useMemo(() => {
    const installedModels = allModels.filter((model) =>
      installedModelIds.has(model.reference),
    );

    // TODO: filter with recent models

    const filteredModels = installedModels.filter((entity) =>
      doesEntityContainSearchTerm(entity, searchTerm),
    );
    const groupedModels = groupModelsAndSaveOrder(filteredModels);
    const orderedModels = groupedModels.map(
      ({ entities }) => orderBy(entities, 'version', 'desc')[0],
    );

    if (conversation.playback?.isPlayback) {
      orderedModels.unshift({
        id: PseudoModel.Playback,
        name: t('Playback'),
        reference: PseudoModel.Playback,
        type: EntityType.Model,
        isDefault: false,
      });
    } else if (conversation.replay?.isReplay) {
      orderedModels.unshift({
        id: REPLAY_AS_IS_MODEL,
        name: t('Replay as is'),
        reference: REPLAY_AS_IS_MODEL,
        type: EntityType.Model,
        isDefault: false,
      });
    } else if (!allModelsRefs.includes(conversation.model.id)) {
      orderedModels.unshift({
        id: conversation.model.id,
        name: conversation.model.id,
        reference: conversation.model.id,
        description: t('chat.error.incorrect-selected', {
          context: EntityType.Model,
        }),
        type: EntityType.Model,
        isDefault: false,
      });
    }

    return chunk(orderedModels, 9);
  }, [
    allModels,
    allModelsRefs,
    conversation.model.id,
    conversation.playback?.isPlayback,
    conversation.replay?.isReplay,
    installedModelIds,
    searchTerm,
    t,
  ]);

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
    if (activeSlide !== 0 && activeSlide > sliderGroups.length - 1) {
      setActiveSlide(sliderGroups.length - 1);
    }
  }, [activeSlide, sliderGroups]);

  const handleCardClick = useCallback(
    (entity: DialAIEntityModel) => {
      onChangeModel(conversation, entity.reference);
    },
    [conversation, onChangeModel],
  );

  const sliderDotsArray = range(0, sliderGroups.length || 1);

  return (
    <Modal
      portalId="chat"
      state={ModalState.OPENED}
      dataQa="talk-to-modal"
      containerClassName="flex h-fit p-6 max-h-full flex-col rounded py-3 md:py-4 w-full grow items-start justify-center !bg-layer-2 max-w-[1200px] w-[1200px]"
      onClose={onClose}
    >
      <h3 className="font-semibold">{t('Select an agent for conversation')}</h3>
      <div className="relative my-4 w-full">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2"
          size={18}
        />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('Search') ?? ''}
          className="input-form peer pl-[38px]"
          data-qa="search-models"
        />
      </div>
      <div ref={sliderRef} className="w-full overflow-y-auto overflow-x-hidden">
        <div
          {...swipeHandlers}
          className="flex w-full gap-4 transition duration-1000 ease-out"
          style={{
            transform: calculateTranslateX(
              activeSlide,
              sliderRef.current?.clientWidth,
            ),
            gap: `${GRID_GAP}px`,
          }}
        >
          {sliderGroups.map((modelsGroup) => (
            <section
              key={modelsGroup.map((model) => model.id).join('.')}
              className="min-w-full"
            >
              <ul
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-5 2xl:grid-cols-4"
                data-qa="applications"
              >
                {modelsGroup.map((model) => (
                  <TalkToCard
                    onSelectVersion={handleCardClick}
                    isSelected={
                      (model.id === conversation.model.id &&
                        !conversation.playback?.isPlayback &&
                        !conversation.replay?.replayAsIs) ||
                      model.id === PseudoModel.Playback ||
                      (model.id === REPLAY_AS_IS_MODEL &&
                        !!conversation.replay?.replayAsIs)
                    }
                    isUnavailableModel={
                      !allModelsRefs.includes(model.reference) &&
                      !isPseudoModel(model.id) &&
                      model.id !== REPLAY_AS_IS_MODEL
                    }
                    disabled={
                      !!conversation.playback?.isPlayback &&
                      model.id !== PseudoModel.Playback
                    }
                    key={model.id}
                    entity={model}
                    onClick={handleCardClick}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <div className="mt-4 flex w-full items-center justify-between">
        <span></span>
        <div className="flex items-center gap-4">
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
          {sliderDotsArray.map((slideNumber) => (
            <button
              key={slideNumber}
              onClick={() => setActiveSlide(slideNumber)}
              className={classNames(
                'size-2 rounded-full bg-controls-disable transition-all duration-200',
                slideNumber === activeSlide ? 'h-2 w-8' : 'size-2',
              )}
            ></button>
          ))}
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
        </div>
        <button
          onClick={() =>
            router.push(
              `/marketplace?${MarketplaceQueryParams.fromConversation}=${ApiUtils.encodeApiUrl(conversation.id)}`,
            )
          }
          className="text-accent-primary"
        >
          {t('Go to My workspace')}
        </button>
      </div>
    </Modal>
  );
};
