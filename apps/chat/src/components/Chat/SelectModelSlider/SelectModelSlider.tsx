import { FC, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useFuseSearch } from '@/src/hooks/useFuseSearch';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalApp } from '@/src/utils/app/application';
import { groupMarketplaceEntityAndSaveOrder } from '@/src/utils/app/marketplace';
import { isSmallScreenOrTouchable } from '@/src/utils/app/mobile';
import { getLocalizedEntitySearchOptions } from '@/src/utils/app/search';
import { PseudoModel } from '@/src/utils/server/api';

import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityModel } from '@/src/types/models';
import { CardType } from '@/src/types/talkTo';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';
import { WidgetsSelectors } from '@/src/store/models/widgets.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { REPLAY_AS_IS_MODEL } from '@/src/constants/chat';
import { ChatI18nKeys } from '@/src/constants/i18n';
import {
  ChangeMarketplaceTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { SuggestedCard } from '@/src/constants/talkTo';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { Modal } from '@/src/components/Common/Modal';
import { SliderGrid } from '@/src/components/Common/SliderGrid/SliderGrid';
import { TalkToNotFound } from '@/src/components/Common/TalkToNotFound';

import { Feature } from '@epam/ai-dial-shared';
import { DialLinkButton, DialSearch } from '@epam/ai-dial-ui-kit';
import orderBy from 'lodash-es/orderBy';

interface TabButtonProps {
  tab: MarketplaceTabs;
  setTab: (tab: MarketplaceTabs) => void;
  currentTab: MarketplaceTabs;
}

function AgentsTabButton({ tab, setTab, currentTab }: TabButtonProps) {
  const { t } = useTranslation(Translation.Chat);

  return (
    <TabButton
      tabKey={tab}
      selected={currentTab === tab}
      onClick={setTab}
      dataQA={tab}
    >
      {t(ChangeMarketplaceTabs[tab])}
    </TabButton>
  );
}

interface SelectModelSliderProps<P> {
  onClose: () => void;
  models: DialAIEntityModel[];
  currentModelId: string;
  tab: MarketplaceTabs;
  setTab: (tab: MarketplaceTabs) => void;

  SliderItem: FC<P & { groupItem: CardType }>;
  itemProps: P;

  onGoToWorkspace?: () => void;
  isReplay?: boolean;
  isPlayback?: boolean;
  title?: string;
}

const SelectModelSliderView = <T extends object>({
  models,
  currentModelId,
  tab,
  setTab,
  SliderItem,
  itemProps,
  isReplay,
  isPlayback,
  onGoToWorkspace,
  title,
}: Omit<SelectModelSliderProps<T>, 'onClose'>) => {
  const { t } = useTranslation(Translation.Chat);
  const headerRef = useRef<HTMLDivElement>(null);

  const isMyWorkspace = tab === MarketplaceTabs.MY_WORKSPACE;
  const [headerHeight, setHeaderHeight] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [prevActiveSlide, setPrevActiveSlide] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const isMarketplaceEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.Marketplace),
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const installedModelIdsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const recentModelIds = useAppSelector(ModelsSelectors.selectRecentModelsIds);
  const widgetsSchemaIds = useAppSelector(
    WidgetsSelectors.selectWidgetsSchemaIds,
  );

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const locale = useAppSelector(UISelectors.selectLocale);

  const searchOptions = useMemo(
    () => getLocalizedEntitySearchOptions<DialAIEntityModel>(locale),
    [locale],
  );

  const searchedModels = useFuseSearch(models, searchTerm, searchOptions);

  useLayoutEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, []);

  const sortedModels = useMemo(() => {
    const currentModel = modelsMap[currentModelId];

    if (!isMyWorkspace) {
      return currentModel
        ? [
            currentModel,
            ...searchedModels.filter(
              (m) => currentModel?.reference !== m.reference,
            ),
          ]
        : searchedModels;
    }
    const recentInstalledModels = recentModelIds
      .filter((id) => installedModelIdsSet.has(id) && modelsMap[id])
      .map((id) => modelsMap[id]) as DialAIEntityModel[];
    const installedModels = searchedModels.filter(
      (model) =>
        installedModelIdsSet.has(model.reference) && modelsMap[model.reference],
    );
    return [
      ...(currentModel &&
      (installedModelIdsSet.has(currentModel.reference) || !isReplay)
        ? [currentModel]
        : []),
      ...recentInstalledModels,
      ...installedModels,
    ];
  }, [
    isReplay,
    searchedModels,
    currentModelId,
    installedModelIdsSet,
    isMyWorkspace,
    modelsMap,
    recentModelIds,
  ]);

  const displayedModels = useMemo(() => {
    const filteredModels = sortedModels.filter(
      (entity) =>
        !isExternalApp(entity) &&
        !widgetsSchemaIds.has(entity.applicationTypeSchemaId as string) &&
        !!searchedModels.find((m) => m.reference === entity.reference),
    );
    const groupedModels = groupMarketplaceEntityAndSaveOrder(filteredModels);
    const orderedModels: CardType[] = groupedModels.map(({ entities }) => {
      const selectedEntity = entities.find(
        ({ reference }) => reference === currentModelId,
      );

      if (selectedEntity) {
        return selectedEntity;
      }

      return orderBy(entities, 'version', 'desc')[0];
    });

    if (isPlayback) {
      orderedModels.unshift({
        id: PseudoModel.Playback,
        name: t(ChatI18nKeys.Playback),
        reference: PseudoModel.Playback,
        type: EntityType.Model,
        isDefault: false,
      });
    } else if (isReplay) {
      orderedModels.unshift({
        id: REPLAY_AS_IS_MODEL,
        name: t(ChatI18nKeys.ReplayAsIs),
        description: t(ChatI18nKeys.ReplayAsIsDescription),
        reference: REPLAY_AS_IS_MODEL,
        type: EntityType.Model,
        isDefault: false,
      });
    } else if (!modelsMap[currentModelId]) {
      orderedModels.unshift({
        id: currentModelId,
        name: currentModelId,
        reference: currentModelId,
        description: t(ChatI18nKeys.IncorrectSelectedModel, {
          context: EntityType.Model,
        }),
        type: EntityType.Model,
        isDefault: false,
      });
    }

    if (isMyWorkspace && searchTerm.length > 0 && orderedModels.length > 0) {
      orderedModels.push(SuggestedCard);
    }

    return orderedModels;
  }, [
    searchedModels,
    sortedModels,
    isPlayback,
    isReplay,
    modelsMap,
    currentModelId,
    isMyWorkspace,
    searchTerm.length,
    widgetsSchemaIds,
    t,
  ]);

  const sliderResetDependencies = useMemo(
    () => [isMyWorkspace, searchTerm],
    [isMyWorkspace, searchTerm],
  );

  return (
    <>
      <h3 className="text-base font-semibold">
        {title ?? t(ChatI18nKeys.SelectAgentForConversation)}
      </h3>
      <div className="flex max-h-full min-h-0 w-full flex-1 flex-col">
        <div
          ref={headerRef}
          className="relative my-4 flex w-full gap-2 max-sm:flex-col-reverse sm:gap-4"
        >
          <DialSearch
            containerClassName="flex-1"
            data-qa="search-agents"
            autoFocus={isOverlay || !isSmallScreenOrTouchable()}
            placeholder={t(ChatI18nKeys.Search)}
            value={searchTerm}
            onChange={setSearchTerm}
          />

          <div className="flex gap-2 sm:gap-3">
            {[MarketplaceTabs.MY_WORKSPACE, MarketplaceTabs.HOME].map(
              (marketplaceTab) => (
                <AgentsTabButton
                  key={marketplaceTab}
                  tab={marketplaceTab}
                  setTab={setTab}
                  currentTab={tab}
                />
              ),
            )}
          </div>
        </div>

        <SliderGrid<CardType, T>
          items={displayedModels}
          SliderItem={SliderItem}
          notFound={
            <TalkToNotFound
              isMyWorkspace={isMyWorkspace}
              onOpenMarketplaceTab={() => setTab(MarketplaceTabs.HOME)}
            />
          }
          sliderResetDependencies={sliderResetDependencies}
          itemProps={itemProps}
          modalHeaderHeight={headerHeight}
          activeSlide={activeSlide}
          prevActiveSlide={prevActiveSlide}
          onSetActiveSlide={setActiveSlide}
          onSetPrevActiveSlide={setPrevActiveSlide}
          footerButton={
            isMarketplaceEnabled &&
            onGoToWorkspace && (
              <DialLinkButton
                onClick={onGoToWorkspace}
                tooltipProps={{
                  tooltip: isPlayback
                    ? t(ChatI18nKeys.EditingNotAvailableInPlayback)
                    : undefined,
                }}
                data-qa={
                  isMyWorkspace ? 'go-to-my-workspace' : 'go-to-marketplace'
                }
                label={t(
                  isMyWorkspace
                    ? ChatI18nKeys.GoToMyWorkspace
                    : ChatI18nKeys.GoToDIALMarketplace,
                )}
              />
            )
          }
        />
      </div>
    </>
  );
};

export const SelectModelSlider = <T extends object>({
  onClose,
  ...rest
}: SelectModelSliderProps<T>) => (
  <Modal
    portalId="theme-main"
    state={ModalState.OPENED}
    dataQa="talk-to-agent"
    containerClassName="flex xl:h-fit relative max-h-full flex-col rounded py-4 px-3 md:p-6 w-full grow items-start justify-center !bg-layer-2 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
    onClose={onClose}
  >
    <SelectModelSliderView {...rest} />
  </Modal>
);
