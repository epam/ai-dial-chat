import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';

import { useFuseSearch } from '@/src/hooks/useFuseSearch';
import { useSessionStorageState } from '@/src/hooks/useSessionStorageState';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getModelName,
  isDialAiEntityModel,
  isExternalApp,
} from '@/src/utils/app/application';
import { getEntityBaseId, sortItemsVersions } from '@/src/utils/app/common';
import { groupMarketplaceEntityAndSaveOrder } from '@/src/utils/app/marketplace';
import { isSmallScreenOrTouchable } from '@/src/utils/app/mobile';
import {
  getNumberFromSearchParams,
  getStringFromSearchParams,
  updateQueryParams,
} from '@/src/utils/app/url/query-params';
import { isInstalledEntity } from '@/src/utils/marketplace';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { ModalState } from '@/src/types/modal';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ModelsSelectors,
  SettingsSelectors,
  ToolsetSelectors,
  UISelectors,
  WidgetsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import { ChatI18nKeys } from '@/src/constants/i18n';
import {
  ChangeMarketplaceTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { AgentsAndToolsetsModalQueryParams } from '@/src/constants/quick-apps';
import { Routes } from '@/src/constants/routes';
import { MARKETPLACE_ENTITIES_SEARCH_OPTIONS } from '@/src/constants/search';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { Modal } from '@/src/components/Common/Modal';
import {
  SliderGrid,
  SliderGridRef,
} from '@/src/components/Common/SliderGrid/SliderGrid';

import { TalkToNotFound } from '../TalkToNotFound';
import {
  AgentAndToolsetSelectItem,
  AgentAndToolsetSelectItemProps,
} from './AgentAndToolsetSelectItem';
import { SelectedItemsContainer } from './SelectedItemsContainer';

import {
  DialNeutralButton,
  DialPrimaryButton,
  DialSearch,
} from '@epam/ai-dial-ui-kit';
import sortBy from 'lodash-es/sortBy';

type DisplayedMarketplaceEntity = MarketplaceEntity & {
  allVersions?: MarketplaceEntity[];
};

type TextMap = Record<string, string>;
interface ScopeTabButtonProps {
  tab: MarketplaceTabs;
  currentTab: MarketplaceTabs;
  textMap: TextMap;
  onSetTab: (tab: MarketplaceTabs) => void;
}

function ScopeTabButton({
  tab,
  currentTab,
  textMap,
  onSetTab,
}: ScopeTabButtonProps) {
  const { t } = useTranslation(Translation.Chat);
  const buttonText = textMap[tab] || tab;
  return (
    <TabButton
      tabKey={tab}
      selected={currentTab === tab}
      onClick={onSetTab}
      dataQA={tab}
    >
      {t(buttonText)}
    </TabButton>
  );
}

interface AgentAndToolsetModalViewProps {
  initialSelectedIds: string[];
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
  saveSliderStateInURL: boolean;
  sessionKey: string;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

const AgentAndToolsetModalView = ({
  initialSelectedIds,
  allItemsMap,
  saveSliderStateInURL,
  sessionKey,
  onClose,
  onConfirm,
}: AgentAndToolsetModalViewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const router = useRouter();
  const searchParams = useSearchParams();

  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const sliderGridRef = useRef<SliderGridRef>(null);
  const programmaticScroll = useRef(false);

  const [activeSlide, setActiveSlide] = useState(
    getNumberFromSearchParams(
      searchParams,
      AgentsAndToolsetsModalQueryParams.SliderActiveSlide,
    ),
  );
  const [prevActiveSlide, setPrevActiveSlide] = useState(
    getNumberFromSearchParams(
      searchParams,
      AgentsAndToolsetsModalQueryParams.SliderPrevActiveSlide,
    ),
  );

  const [shouldResetSliderState, setShouldResetSliderState] = useState(false);
  const [footerHeight, setFooterHeight] = useState<number | undefined>(
    undefined,
  );
  const [headerHeight, setHeaderHeight] = useState<number | undefined>(
    undefined,
  );
  const [scopeTab, setScopeTab] = useState<MarketplaceTabs>(
    getStringFromSearchParams<MarketplaceTabs>(
      searchParams,
      AgentsAndToolsetsModalQueryParams.ScopeTab,
      MarketplaceTabs.MY_WORKSPACE,
    ),
  );
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get(AgentsAndToolsetsModalQueryParams.SearchTerm) ?? '',
  );
  const [selectedIds, setSelectedIds] = useSessionStorageState<string[]>(
    sessionKey,
    initialSelectedIds ?? [],
  );
  const [scrollToItemId, setScrollToItemId] = useState<string | null>(null);

  const isMyWorkspace = scopeTab === MarketplaceTabs.MY_WORKSPACE;

  const allAgents = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector((state) =>
    ToolsetSelectors.selectToolsets(state, true),
  );
  const widgetsSchemaIds = useAppSelector(
    WidgetsSelectors.selectWidgetsSchemaIds,
  );
  const installedAgentsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const installedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const locale = useAppSelector(UISelectors.selectLocale);

  const currentAppReference =
    router.route === Routes.AppsEditor
      ? router.query[AppsEditorQuery.Id]?.toString()
      : undefined;

  useLayoutEffect(() => {
    if (footerRef.current) {
      setFooterHeight(footerRef.current.offsetHeight);
    }
  }, []);

  useLayoutEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight);
    }
  }, [selectedIds]);

  useEffect(() => {
    if (saveSliderStateInURL) {
      updateQueryParams({
        [AgentsAndToolsetsModalQueryParams.Modal]: '1',
        [AgentsAndToolsetsModalQueryParams.SliderActiveSlide]:
          activeSlide.toString(),
        [AgentsAndToolsetsModalQueryParams.SliderPrevActiveSlide]:
          prevActiveSlide.toString(),
        [AgentsAndToolsetsModalQueryParams.SearchTerm]: searchTerm,
        [AgentsAndToolsetsModalQueryParams.ScopeTab]: scopeTab.toString(),
      });
    }
  }, [
    activeSlide,
    prevActiveSlide,
    saveSliderStateInURL,
    searchTerm,
    scopeTab,
  ]);

  const handleToggleSelectItem = useCallback(
    (itemToToggle: MarketplaceEntity) => {
      const baseId = getEntityBaseId(itemToToggle.id);
      const isGroupSelected = selectedIds.some(
        (id) => getEntityBaseId(id) === baseId,
      );

      if (isGroupSelected) {
        setSelectedIds((prevIds) =>
          prevIds.filter((id) => getEntityBaseId(id) !== baseId),
        );
      } else {
        setSelectedIds((prevIds) => [...prevIds, itemToToggle.id]);
      }
      setScrollToItemId(null);
    },
    [selectedIds, setSelectedIds],
  );

  const handleSetVersion = useCallback(
    (oldVersionId: string, newVersionId: string) => {
      setSelectedIds((currentIds) => {
        const index = currentIds.findIndex((id) => id === oldVersionId);
        if (index !== -1) {
          const newIds = [...currentIds];
          newIds[index] = newVersionId;
          return newIds;
        }

        const baseId = getEntityBaseId(newVersionId);
        const anotherVersionIndex = currentIds.findIndex(
          (id) => getEntityBaseId(id) === baseId,
        );
        if (anotherVersionIndex !== -1) {
          const newIds = [...currentIds];
          newIds[anotherVersionIndex] = newVersionId;
          return newIds;
        }

        return currentIds;
      });
      setScrollToItemId(null);
    },
    [setSelectedIds],
  );

  const handleSetScopeTab = useCallback(
    (tab: MarketplaceTabs = MarketplaceTabs.HOME) => {
      setScopeTab(tab);
      setShouldResetSliderState(true);
      setActiveSlide(0);
      setScrollToItemId(null);
    },
    [setScrollToItemId],
  );

  const handleSetSearchTerm = (searchTerm: string) => {
    setSearchTerm(searchTerm);
    setShouldResetSliderState(true);
  };

  const handleRemoveItem = useCallback(
    (idToRemove: string) => {
      setSelectedIds((prevIds) => prevIds.filter((id) => id !== idToRemove));
      setScrollToItemId(null);
    },
    [setSelectedIds],
  );

  const allItems = useMemo(
    () => [...allAgents, ...allToolsets],
    [allAgents, allToolsets],
  );

  const searchedItems = useFuseSearch(
    allItems,
    searchTerm,
    MARKETPLACE_ENTITIES_SEARCH_OPTIONS,
  );

  const selectedBaseIdsSet = useMemo(
    () => new Set(selectedIds.map(getEntityBaseId)),
    [selectedIds],
  );

  const installedSet = useMemo(
    () => new Set([...installedAgentsSet, ...installedToolsetsSet]),
    [installedAgentsSet, installedToolsetsSet],
  );

  const displayedItems: DisplayedMarketplaceEntity[] = useMemo(() => {
    const getSelectedItemFromGroup = ({
      entities,
    }: {
      entities: MarketplaceEntity[];
    }): DisplayedMarketplaceEntity | null => {
      if (!entities.length) return null;
      let activeVersion: MarketplaceEntity | undefined;

      if (scrollToItemId) {
        activeVersion = entities.find((entity) => entity.id === scrollToItemId);
      }

      if (!activeVersion) {
        const reversedSelectedIds = selectedIds.toReversed();
        const lastSelectedIdInGroup = reversedSelectedIds.find((id) =>
          entities.some((entity) => entity.id === id),
        );
        if (lastSelectedIdInGroup) {
          activeVersion = entities.find(
            (entity) => entity.id === lastSelectedIdInGroup,
          );
        }
      }

      if (!activeVersion) {
        activeVersion = sortItemsVersions(entities)[0];
      }

      return { ...activeVersion!, allVersions: entities };
    };

    const filteredItems = searchedItems.filter((entity) => {
      if (isDialAiEntityModel(entity)) {
        return (
          !isExternalApp(entity) &&
          !widgetsSchemaIds.has(entity.applicationTypeSchemaId as string) &&
          entity.reference !== currentAppReference
        );
      }
      return true;
    });

    const allGroupedItemsUnsorted = groupMarketplaceEntityAndSaveOrder(
      filteredItems,
    )
      .map(getSelectedItemFromGroup)
      .filter((item): item is DisplayedMarketplaceEntity => !!item);

    const allGroupedItems = sortBy(allGroupedItemsUnsorted, [
      (item) => getModelName(item, locale).toLowerCase(),
    ]);

    if (!isMyWorkspace) {
      return allGroupedItems;
    }

    return allGroupedItems.filter((item) =>
      isInstalledEntity(item, installedSet),
    );
  }, [
    searchedItems,
    isMyWorkspace,
    scrollToItemId,
    selectedIds,
    widgetsSchemaIds,
    currentAppReference,
    installedSet,
    locale,
  ]);

  const handleItemClick = useCallback(
    (id: string) => {
      setSearchTerm('');
      const isAlreadyDisplayed = displayedItems.some((item) => item.id === id);
      programmaticScroll.current = true;

      if (isAlreadyDisplayed) {
        sliderGridRef.current?.scrollToItem(id);
      } else {
        const item = allItemsMap[id];
        if (isMyWorkspace && item && !isInstalledEntity(item, installedSet)) {
          handleSetScopeTab(MarketplaceTabs.HOME);
        }

        setScrollToItemId(id);
      }
    },
    [
      displayedItems,
      allItemsMap,
      isMyWorkspace,
      installedSet,
      handleSetScopeTab,
      setSearchTerm,
    ],
  );

  useEffect(() => {
    if (
      scrollToItemId &&
      displayedItems.some((item) => item.id === scrollToItemId)
    ) {
      sliderGridRef.current?.scrollToItem(scrollToItemId);
    }
    setTimeout(() => {
      programmaticScroll.current = false;
    }, 0);
  }, [scrollToItemId, displayedItems]);

  useEffect(() => {
    if (!programmaticScroll.current) {
      setScrollToItemId(null);
    }
  }, [activeSlide, scopeTab, searchTerm]);

  const sliderItemProps = useMemo(
    () => ({
      selectedBaseIdsSet,
      onToggleSelectItem: handleToggleSelectItem,
      onSetVersion: handleSetVersion,
    }),
    [selectedBaseIdsSet, handleToggleSelectItem, handleSetVersion],
  );

  const sliderResetDependencies = useMemo(
    () => (shouldResetSliderState ? [isMyWorkspace, searchTerm] : undefined),
    [isMyWorkspace, searchTerm, shouldResetSliderState],
  );

  useEffect(() => {
    if (shouldResetSliderState) {
      setShouldResetSliderState(false);
    }
  }, [shouldResetSliderState]);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedIds);
  }, [selectedIds, onConfirm]);

  return (
    <>
      <h3 className="w-full px-6 pt-6 text-base font-semibold">
        {t(ChatI18nKeys.SelectAgentsAndToolsets)}
      </h3>
      <div className="flex max-h-full min-h-0 w-full flex-1 flex-col px-5 pb-2">
        <div ref={headerRef} className="mb-2">
          <div className="relative my-4 flex w-full gap-2 max-sm:flex-col-reverse sm:gap-4">
            <DialSearch
              containerClassName="flex-1"
              data-qa="search-agents"
              autoFocus={isOverlay || !isSmallScreenOrTouchable()}
              placeholder={t(ChatI18nKeys.Search)}
              value={searchTerm}
              onChange={handleSetSearchTerm}
            />

            <div className="flex gap-2 sm:gap-3">
              {[MarketplaceTabs.MY_WORKSPACE, MarketplaceTabs.HOME].map(
                (tab) => (
                  <ScopeTabButton
                    key={tab}
                    tab={tab}
                    onSetTab={handleSetScopeTab}
                    currentTab={scopeTab}
                    textMap={ChangeMarketplaceTabs}
                  />
                ),
              )}
            </div>
          </div>
          <span className="col-span-1 whitespace-pre-wrap break-words text-xs text-secondary">
            {t(ChatI18nKeys.SelectedLabel)}
          </span>
          <div className="my-2 flex h-[34px] items-center">
            {selectedIds.length ? (
              <SelectedItemsContainer
                selectedIds={selectedIds}
                allItemsMap={allItemsMap}
                onRemove={handleRemoveItem}
                onItemClick={handleItemClick}
              />
            ) : (
              <span className="flex h-[34px] items-center text-xs">
                {t(ChatI18nKeys.NoResourcesSelected)}
              </span>
            )}
          </div>
          <span className="col-span-1 whitespace-pre-wrap break-words text-xs text-secondary">
            {t(ChatI18nKeys.All)}
          </span>
        </div>
        {!!(headerHeight && footerHeight) && (
          <SliderGrid<
            MarketplaceEntity,
            Omit<AgentAndToolsetSelectItemProps, 'groupItem'>
          >
            ref={sliderGridRef}
            items={displayedItems}
            SliderItem={AgentAndToolsetSelectItem}
            notFound={
              <TalkToNotFound
                isMyWorkspace={isMyWorkspace}
                onOpenMarketplaceTab={handleSetScopeTab}
                isSearchMode={!!searchTerm}
              />
            }
            sliderResetDependencies={sliderResetDependencies}
            itemProps={sliderItemProps}
            modalHeaderHeight={headerHeight}
            modalFooterHeight={footerHeight}
            sliderDotsClassName="mt-0 sm:mt-6 sm:h-[60px] mb-[80px] sm:mb-0"
            activeSlide={activeSlide}
            prevActiveSlide={prevActiveSlide}
            onSetActiveSlide={setActiveSlide}
            onSetPrevActiveSlide={setPrevActiveSlide}
          />
        )}
      </div>

      <div
        ref={footerRef}
        className="absolute bottom-0 flex w-full justify-end gap-3 border-t border-tertiary px-6 py-[14px]"
      >
        <DialNeutralButton label={t(ChatI18nKeys.Cancel)} onClick={onClose} />
        <DialPrimaryButton
          label={t(ChatI18nKeys.Confirm)}
          onClick={handleConfirm}
        />
      </div>
    </>
  );
};

interface Props {
  initialSelectedIds: string[];
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
  saveSliderStateInURL?: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

export const AgentAndToolsetModal = ({
  initialSelectedIds,
  allItemsMap,
  saveSliderStateInURL = false,
  onClose,
  onConfirm,
}: Props) => {
  const router = useRouter();
  const sessionKey = useMemo(() => {
    const { pathname, query, isReady } = router;

    if (!isReady) {
      return 'agent-toolset-temporary-selection-loading';
    }

    let contextId: string | undefined = undefined;

    if (pathname.startsWith(Routes.AppsEditor)) {
      const id = query[AppsEditorQuery.Id];
      if (typeof id === 'string') {
        contextId = id;
      }
    } else if (pathname.startsWith(Routes.Chat)) {
      const chatId = query.chatId;
      if (typeof chatId === 'string') {
        contextId = chatId;
      } else if (Array.isArray(chatId) && chatId.length > 0) {
        contextId = chatId[chatId.length - 1];
      }
    }

    if (contextId) {
      return `agent-toolset-temporary-selection-${contextId}`;
    }

    return 'agent-toolset-temporary-selection-fallback';
  }, [router]);

  const isModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );
  const isToolsetsLoading = useAppSelector(ToolsetSelectors.selectIsLoading);
  const isInstalledModelsInitialized = useAppSelector(
    ModelsSelectors.selectIsInstalledModelsInitialized,
  );
  const isInstalledToolsetsInitialized = useAppSelector(
    ToolsetSelectors.selectIsInstalledToolsetsInitialized,
  );

  const isLoading =
    isModelsLoading ||
    isToolsetsLoading ||
    !isInstalledModelsInitialized ||
    !isInstalledToolsetsInitialized;

  const handleClose = useCallback(() => {
    window.sessionStorage.removeItem(sessionKey);
    onClose();
  }, [onClose, sessionKey]);

  const handleConfirm = useCallback(
    (selectedIds: string[]) => {
      window.sessionStorage.removeItem(sessionKey);
      onConfirm(selectedIds);
    },
    [onConfirm, sessionKey],
  );

  useEffect(() => {
    return () => {
      const queryParamsToNull = [
        AgentsAndToolsetsModalQueryParams.Modal,
        AgentsAndToolsetsModalQueryParams.ScopeTab,
        AgentsAndToolsetsModalQueryParams.SearchTerm,
        AgentsAndToolsetsModalQueryParams.SliderActiveSlide,
        AgentsAndToolsetsModalQueryParams.SliderPrevActiveSlide,
      ];
      const hasAnyQueryParam = queryParamsToNull.some((param) =>
        window.location.search.includes(param),
      );

      if (hasAnyQueryParam) {
        updateQueryParams({
          [AgentsAndToolsetsModalQueryParams.Modal]: null,
          [AgentsAndToolsetsModalQueryParams.ScopeTab]: null,
          [AgentsAndToolsetsModalQueryParams.SearchTerm]: null,
          [AgentsAndToolsetsModalQueryParams.SliderActiveSlide]: null,
          [AgentsAndToolsetsModalQueryParams.SliderPrevActiveSlide]: null,
        });
      }
    };
  }, []);

  return (
    <Modal
      portalId="theme-main"
      state={isLoading ? ModalState.LOADING : ModalState.OPENED}
      dataQa="talk-to-agent"
      containerClassName="flex items-center xl:h-fit relative max-h-full flex-col rounded w-full grow items-start justify-center !bg-layer-2 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
      onClose={handleClose}
      heading
    >
      <AgentAndToolsetModalView
        onClose={handleClose}
        onConfirm={handleConfirm}
        initialSelectedIds={initialSelectedIds}
        allItemsMap={allItemsMap}
        saveSliderStateInURL={saveSliderStateInURL}
        sessionKey={sessionKey}
      />
    </Modal>
  );
};
