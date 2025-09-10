import { IconSearch } from '@tabler/icons-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useFuseSearch } from '@/src/hooks/useFuseSearch';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalApp } from '@/src/utils/app/application';
import { sortItemsVersions } from '@/src/utils/app/common';
import { groupMarketplaceEntityAndSaveOrder } from '@/src/utils/app/marketplace';
import { isSmallScreenOrTouchable } from '@/src/utils/app/mobile';
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

import {
  ChangeAgentTabs,
  ChangeToolsetTabs,
  MarketplaceEntitiesTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { MARKETPLACE_ENTITIES_SEARCH_OPTIONS } from '@/src/constants/search';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { AgentAndToolsetChip } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetChip';
import { AgentDialogs } from '@/src/components/Common/AgentDialogs';
import { Modal } from '@/src/components/Common/Modal';
import { SliderGrid } from '@/src/components/Common/SliderGrid/SliderGrid';

import { NoResultsFound } from '../NoResultsFound';
import {
  AgentAndToolsetSelectItem,
  AgentAndToolsetSelectItemProps,
} from './AgentAndToolsetSelectItem';

interface EntityTypeTabsProps {
  currentType: MarketplaceEntitiesTabs;
  setType: (type: MarketplaceEntitiesTabs) => void;
}

function EntityTypeTabs({ currentType, setType }: EntityTypeTabsProps) {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex gap-2">
      <TabButton
        tabKey={MarketplaceEntitiesTabs.AGENTS}
        selected={currentType === MarketplaceEntitiesTabs.AGENTS}
        onClick={setType}
        dataQA="entity-type-agents"
      >
        {t('Agents')}
      </TabButton>
      <TabButton
        tabKey={MarketplaceEntitiesTabs.TOOLSETS}
        selected={currentType === MarketplaceEntitiesTabs.TOOLSETS}
        onClick={setType}
        dataQA="entity-type-toolsets"
      >
        {t('Toolsets')}
      </TabButton>
    </div>
  );
}

type TextMap = Record<string, string>;
interface ScopeTabButtonProps {
  tab: MarketplaceTabs | MarketplaceEntitiesTabs;
  setTab: (tab: MarketplaceTabs | MarketplaceEntitiesTabs) => void;
  currentTab: MarketplaceTabs | MarketplaceEntitiesTabs;
  textMap: TextMap;
}

function ScopeTabButton({
  tab,
  setTab,
  currentTab,
  textMap,
}: ScopeTabButtonProps) {
  const { t } = useTranslation(Translation.Chat);

  const buttonText = textMap[tab] || tab;

  return (
    <TabButton
      tabKey={tab}
      selected={currentTab === tab}
      onClick={setTab}
      dataQA={tab}
    >
      {t(buttonText)}
    </TabButton>
  );
}
interface AgentAndToolsetModalViewProps {
  onClose: () => void;
  onConfirm: (selectedItems: MarketplaceEntity[]) => void;
  initialSelectedIds: string[];
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
}

const AgentAndToolsetModalView = ({
  onClose,
  onConfirm,
  initialSelectedIds,
  allItemsMap,
}: AgentAndToolsetModalViewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const headerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const [footerHeight, setFooterHeight] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);

  const [entityType, setEntityType] = useState<MarketplaceEntitiesTabs>(
    MarketplaceEntitiesTabs.AGENTS,
  );
  const [scopeTab, setScopeTab] = useState<
    MarketplaceTabs | MarketplaceEntitiesTabs
  >(MarketplaceTabs.MY_WORKSPACE);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialSelectedIds ?? [],
  );

  const isMyWorkspace = scopeTab === MarketplaceTabs.MY_WORKSPACE;

  const allAgents = useAppSelector(ModelsSelectors.selectModels);
  const allToolsets = useAppSelector(ToolsetSelectors.selectToolsets);

  const widgetsSchemaIds = useAppSelector(
    WidgetsSelectors.selectWidgetsSchemaIds,
  );

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

  const installedAgentsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const installedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
  );

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  useEffect(() => {
    if (entityType === MarketplaceEntitiesTabs.AGENTS) {
      setScopeTab(MarketplaceTabs.MY_WORKSPACE);
    } else {
      setScopeTab(MarketplaceEntitiesTabs.AGENTS);
    }
  }, [entityType]);

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

  const displayedItems = useMemo(() => {
    const isMyWorkspaceView =
      scopeTab === MarketplaceTabs.MY_WORKSPACE ||
      scopeTab === MarketplaceEntitiesTabs.AGENTS;

    const groupedAndOrderedAgents = groupMarketplaceEntityAndSaveOrder(
      searchedAgents.filter(
        (entity) =>
          !isExternalApp(entity) &&
          !widgetsSchemaIds.has(entity.applicationTypeSchemaId as string),
      ),
    ).map(({ entities }) => sortItemsVersions(entities)[0]);

    const groupedAndOrderedToolsets = groupMarketplaceEntityAndSaveOrder(
      searchedToolsets,
    ).map(({ entities }) => sortItemsVersions(entities)[0]);

    if (entityType === MarketplaceEntitiesTabs.AGENTS) {
      if (isMyWorkspaceView) {
        return groupedAndOrderedAgents.filter((item) =>
          isInstalledEntity(item, installedAgentsSet),
        );
      }
      return groupedAndOrderedAgents;
    } else {
      if (isMyWorkspaceView) {
        return groupedAndOrderedToolsets.filter((item) =>
          isInstalledEntity(item, installedToolsetsSet),
        );
      }
      return groupedAndOrderedToolsets;
    }
  }, [
    scopeTab,
    entityType,
    widgetsSchemaIds,
    searchedAgents,
    installedAgentsSet,
    searchedToolsets,
    installedToolsetsSet,
  ]);

  const selectedIdsSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const sliderItemProps = useMemo(
    () => ({
      selectedIdsSet,
      onToggleSelectItem: handleToggleSelectItem,
    }),
    [selectedIdsSet, handleToggleSelectItem],
  );

  const sliderResetDependencies = useMemo(
    () => [isMyWorkspace, searchTerm, entityType],
    [isMyWorkspace, searchTerm, entityType],
  );

  const handleConfirm = useCallback(() => {
    const itemsToConfirm = selectedIds
      .map((id) => allItemsMap[id])
      .filter((item): item is MarketplaceEntity => !!item);
    onConfirm(itemsToConfirm);
  }, [selectedIds, allItemsMap, onConfirm]);

  return (
    <>
      <h3 className="w-full border-b border-tertiary px-6 py-4 text-base font-semibold">
        {t('Agents & Toolsets')}
      </h3>
      <div className="flex max-h-full min-h-0 w-full flex-1 flex-col px-5 pb-2 pt-6">
        <div ref={headerRef} className="mb-2">
          <EntityTypeTabs currentType={entityType} setType={setEntityType} />
          <div className="relative my-4 flex w-full gap-2 max-sm:flex-col-reverse">
            <div className="relative flex grow">
              <IconSearch
                className="absolute left-3 top-1/2 -translate-y-1/2"
                size={18}
              />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('Search')}
                className="input-form peer m-0 pl-[38px]"
                data-qa="search-agents"
                autoFocus={isOverlay || !isSmallScreenOrTouchable()}
              />
            </div>
            <div className="flex gap-2">
              {entityType === MarketplaceEntitiesTabs.AGENTS ? (
                <div className="flex gap-2">
                  <ScopeTabButton
                    tab={MarketplaceTabs.MY_WORKSPACE}
                    setTab={setScopeTab}
                    currentTab={scopeTab}
                    textMap={ChangeAgentTabs}
                  />
                  <ScopeTabButton
                    tab={MarketplaceTabs.HOME}
                    setTab={setScopeTab}
                    currentTab={scopeTab}
                    textMap={ChangeAgentTabs}
                  />
                </div>
              ) : (
                <div className="flex gap-2">
                  <ScopeTabButton
                    tab={MarketplaceEntitiesTabs.AGENTS}
                    setTab={setScopeTab}
                    currentTab={scopeTab}
                    textMap={ChangeToolsetTabs}
                  />
                  <ScopeTabButton
                    tab={MarketplaceEntitiesTabs.TOOLSETS}
                    setTab={setScopeTab}
                    currentTab={scopeTab}
                    textMap={ChangeToolsetTabs}
                  />
                </div>
              )}
            </div>
          </div>
          <span className="col-span-1 whitespace-pre-wrap break-words text-xs text-secondary">
            {t('Selected')}
          </span>
          <div className="my-2 flex  flex-wrap gap-2">
            {selectedIds.length ? (
              selectedIds.map((id) => (
                <AgentAndToolsetChip
                  key={id}
                  id={id}
                  item={allItemsMap[id]}
                  onRemove={handleRemoveItem}
                />
              ))
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
          items={displayedItems}
          SliderItem={AgentAndToolsetSelectItem}
          notFound={<NoResultsFound />}
          sliderResetDependencies={sliderResetDependencies}
          itemProps={sliderItemProps}
          modalHeaderHeight={headerHeight}
          modalFooterHeight={footerHeight}
        />
      </div>

      <AgentDialogs />

      <div
        ref={footerRef}
        className="mt-4 flex w-full justify-end gap-2 border-t border-tertiary px-3 py-4"
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
  onClose: () => void;
  onConfirm: (selectedItems: MarketplaceEntity[]) => void;
  initialSelectedIds: string[];
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
}

export const AgentAndToolsetModal = ({
  onClose,
  onConfirm,
  initialSelectedIds,
  allItemsMap,
}: Props) => {
  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      dataQa="talk-to-agent"
      containerClassName="flex xl:h-fit relative max-h-full flex-col rounded w-full grow items-start justify-center !bg-layer-3 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
      onClose={onClose}
      heading
    >
      <AgentAndToolsetModalView
        onClose={onClose}
        onConfirm={onConfirm}
        initialSelectedIds={initialSelectedIds}
        allItemsMap={allItemsMap}
      />
    </Modal>
  );
};
