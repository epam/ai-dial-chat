import { IconSearch } from '@tabler/icons-react';
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
import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalApp } from '@/src/utils/app/application';
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
  WidgetsSelectors,
} from '@/src/store/selectors';

import { AppsEditorQuery } from '@/src/constants/applications';
import {
  ChangeMarketplaceTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { AgentsAndToolsetsModalQueryParams } from '@/src/constants/quick-apps';
import { Routes } from '@/src/constants/routes';
import { MARKETPLACE_ENTITIES_SEARCH_OPTIONS } from '@/src/constants/search';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { AgentDialogs } from '@/src/components/Common/AgentDialogs';
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
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

const AgentAndToolsetModalView = ({
  initialSelectedIds,
  allItemsMap,
  saveSliderStateInURL,
  onClose,
  onConfirm,
}: AgentAndToolsetModalViewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const router = useRouter();
  const searchParams = useSearchParams();

  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const sliderGridRef = useRef<SliderGridRef>(null);
  const currentAppReference =
    router.route === Routes.AppsEditor
      ? router.query[AppsEditorQuery.Id]?.toString()
      : undefined;

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
  const [footerHeight, setFooterHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
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
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedIds ?? [],
  );

  const isMyWorkspace = scopeTab === MarketplaceTabs.MY_WORKSPACE;

  const allAgents = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);
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
      setSelectedIds((prevIds) => {
        if (prevIds.includes(itemToToggle.id)) {
          return prevIds.filter((id) => id !== itemToToggle.id);
        }
        return [...prevIds, itemToToggle.id];
      });
    },
    [],
  );

  const handleSetScopeTab = useCallback(
    (tab: MarketplaceTabs = MarketplaceTabs.HOME) => {
      setScopeTab(tab);
      setShouldResetSliderState(true);
    },
    [],
  );

  const handleSetSearchTerm = (searchTerm: string) => {
    setSearchTerm(searchTerm);
    setShouldResetSliderState(true);
  };

  const handleRemoveItem = useCallback((idToRemove: string) => {
    setSelectedIds((prevIds) => prevIds.filter((id) => id !== idToRemove));
  }, []);

  const searchedAgents = useFuseSearch(
    allAgents,
    searchTerm,
    MARKETPLACE_ENTITIES_SEARCH_OPTIONS,
  );
  const searchedToolsets = useFuseSearch(
    allToolsets,
    searchTerm,
    MARKETPLACE_ENTITIES_SEARCH_OPTIONS,
  );

  const selectedBaseIdsSet = useMemo(
    () => new Set(selectedIds.map(getEntityBaseId)),
    [selectedIds],
  );

  const sliderItemProps = useMemo(
    () => ({
      selectedBaseIdsSet,
      onToggleSelectItem: handleToggleSelectItem,
    }),
    [selectedBaseIdsSet, handleToggleSelectItem],
  );

  const installedSet = useMemo(
    () => new Set([...installedAgentsSet, ...installedToolsetsSet]),
    [installedAgentsSet, installedToolsetsSet],
  );

  const displayedItems = useMemo(() => {
    const getSelectedItemFromGroup = (
      entities: MarketplaceEntity[],
    ): MarketplaceEntity => {
      const reversedSelectedIds = selectedIds.toReversed();
      const lastSelectedIdInGroup = reversedSelectedIds.find((id) =>
        entities.some((entity) => entity.id === id),
      );

      if (lastSelectedIdInGroup) {
        const selectedEntity = entities.find(
          (entity) => entity.id === lastSelectedIdInGroup,
        );
        if (selectedEntity) {
          return selectedEntity;
        }
      }

      return sortItemsVersions(entities)[0];
    };

    const groupedAndOrderedAgents = groupMarketplaceEntityAndSaveOrder(
      searchedAgents.filter(
        (entity) =>
          !isExternalApp(entity) &&
          !widgetsSchemaIds.has(entity.applicationTypeSchemaId as string) &&
          entity.reference !== currentAppReference,
      ),
    ).map(({ entities }) => getSelectedItemFromGroup(entities));

    const groupedAndOrderedToolsets = groupMarketplaceEntityAndSaveOrder(
      searchedToolsets,
    ).map(({ entities }) => getSelectedItemFromGroup(entities));

    const allGroupedItems = [
      ...groupedAndOrderedAgents,
      ...groupedAndOrderedToolsets,
    ];

    if (!isMyWorkspace) {
      return allGroupedItems;
    }

    return allGroupedItems.filter((item) =>
      isInstalledEntity(item, installedSet),
    );
  }, [
    currentAppReference,
    searchedAgents,
    searchedToolsets,
    isMyWorkspace,
    selectedIds,
    widgetsSchemaIds,
    installedSet,
  ]);

  const handleItemClick = useCallback(
    (id: string) => {
      const isDisplayed = displayedItems.some((item) => item.id === id);

      if (isDisplayed && sliderGridRef.current) {
        sliderGridRef.current.scrollToItem(id);
      }
    },
    [displayedItems],
  );

  const sliderResetDependencies = useMemo(
    () => (shouldResetSliderState ? [isMyWorkspace, searchTerm] : undefined),
    [isMyWorkspace, searchTerm, shouldResetSliderState],
  );

  const handleConfirm = useCallback(() => {
    onConfirm(selectedIds);
  }, [selectedIds, onConfirm]);

  return (
    <>
      <h3 className="w-full px-6 pt-6 text-base font-semibold">
        {t('Select agents and toolsets')}
      </h3>
      <div className="flex max-h-full min-h-0 w-full flex-1 flex-col px-5 pb-2">
        <div ref={headerRef} className="mb-2">
          <div className="relative my-4 flex w-full gap-2 max-sm:flex-col-reverse">
            <div className="relative flex grow">
              <IconSearch
                className="absolute left-3 top-1/2 -translate-y-1/2"
                size={18}
              />
              <input
                value={searchTerm}
                onChange={(e) => handleSetSearchTerm(e.target.value)}
                placeholder={t('Search')}
                className="input-form peer m-0 pl-[38px]"
                data-qa="search-agents"
                autoFocus={isOverlay || !isSmallScreenOrTouchable()}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex gap-2">
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
          </div>
          <span className="col-span-1 whitespace-pre-wrap break-words text-xs text-secondary">
            {t('Selected')}
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
                {t('No resources selected')}
              </span>
            )}
          </div>

          <span className="col-span-1 whitespace-pre-wrap break-words text-xs text-secondary">
            {t('All')}
          </span>
        </div>
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
      </div>

      <AgentDialogs />

      <div
        ref={footerRef}
        className="absolute bottom-0 flex w-full justify-end gap-3 border-t border-tertiary px-6 py-[14px]"
      >
        <button className="button button-secondary" onClick={onClose}>
          {t('Cancel')}
        </button>
        <button className="button button-primary" onClick={handleConfirm}>
          {t('Confirm')}
        </button>
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
  const isModelsLoading = useAppSelector(
    ModelsSelectors.selectAreModelsLoading,
  );
  const isToolsetsLoading = useAppSelector(ToolsetSelectors.selectIsLoading);

  return (
    <Modal
      portalId="theme-main"
      state={
        isModelsLoading || isToolsetsLoading
          ? ModalState.LOADING
          : ModalState.OPENED
      }
      dataQa="talk-to-agent"
      containerClassName="flex items-center xl:h-fit relative max-h-full flex-col rounded w-full grow items-start justify-center !bg-layer-2 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
      onClose={onClose}
      heading
    >
      <AgentAndToolsetModalView
        onClose={onClose}
        onConfirm={onConfirm}
        initialSelectedIds={initialSelectedIds}
        allItemsMap={allItemsMap}
        saveSliderStateInURL={saveSliderStateInURL}
      />
    </Modal>
  );
};
