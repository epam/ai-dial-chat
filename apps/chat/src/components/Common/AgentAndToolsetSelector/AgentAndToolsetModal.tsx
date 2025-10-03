import { IconSearch } from '@tabler/icons-react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useFuseSearch } from '@/src/hooks/useFuseSearch';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalApp } from '@/src/utils/app/application';
import { getEntityBaseId, sortItemsVersions } from '@/src/utils/app/common';
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
  ChangeMarketplaceTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';
import { MARKETPLACE_ENTITIES_SEARCH_OPTIONS } from '@/src/constants/search';

import { TabButton } from '@/src/components/Buttons/TabButton';
import { AgentAndToolsetChip } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetChip';
import { AgentDialogs } from '@/src/components/Common/AgentDialogs';
import { Modal } from '@/src/components/Common/Modal';
import { SliderGrid } from '@/src/components/Common/SliderGrid/SliderGrid';
import { ToolsetLoginDialog } from '@/src/components/Marketplace/ToolsetLoginDialog';

import { TalkToNotFound } from '../TalkToNotFound';
import {
  AgentAndToolsetSelectItem,
  AgentAndToolsetSelectItemProps,
} from './AgentAndToolsetSelectItem';

type TextMap = Record<string, string>;
interface ScopeTabButtonProps {
  tab: MarketplaceTabs;
  setTab: (tab: MarketplaceTabs) => void;
  currentTab: MarketplaceTabs;
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

  const [scopeTab, setScopeTab] = useState<MarketplaceTabs>(
    MarketplaceTabs.MY_WORKSPACE,
  );
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

  const installedAgentsSet = useAppSelector(
    ModelsSelectors.selectInstalledModelIds,
  );
  const installedToolsetsSet = useAppSelector(
    ToolsetSelectors.selectInstalledToolsetsSet,
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

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

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

  const selectedBaseIdsSet = useMemo(
    () => new Set(selectedIds.map((id) => getEntityBaseId(id))),
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
      const reversedSelectedIds = [...selectedIds].reverse();
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
          !widgetsSchemaIds.has(entity.applicationTypeSchemaId as string),
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
    searchedAgents,
    searchedToolsets,
    isMyWorkspace,
    selectedIds,
    widgetsSchemaIds,
    installedSet,
  ]);

  const sliderResetDependencies = useMemo(
    () => [isMyWorkspace, searchTerm],
    [isMyWorkspace, searchTerm],
  );

  const handleConfirm = useCallback(() => {
    const validIds = selectedIds.filter((id) => !!allItemsMap[id]);
    const itemsToConfirm = validIds.map((id) => allItemsMap[id]!);
    onConfirm(itemsToConfirm);
  }, [selectedIds, allItemsMap, onConfirm]);

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
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('Search')}
                className="input-form peer m-0 pl-[38px]"
                data-qa="search-agents"
                autoFocus={isOverlay || !isSmallScreenOrTouchable()}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex gap-2">
                <ScopeTabButton
                  tab={MarketplaceTabs.MY_WORKSPACE}
                  setTab={setScopeTab}
                  currentTab={scopeTab}
                  textMap={ChangeMarketplaceTabs}
                />
                <ScopeTabButton
                  tab={MarketplaceTabs.HOME}
                  setTab={setScopeTab}
                  currentTab={scopeTab}
                  textMap={ChangeMarketplaceTabs}
                />
              </div>
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
          notFound={
            <TalkToNotFound
              isMyWorkspace={isMyWorkspace}
              onOpenMarketplaceTab={() => setScopeTab(MarketplaceTabs.HOME)}
            />
          }
          sliderResetDependencies={sliderResetDependencies}
          itemProps={sliderItemProps}
          modalHeaderHeight={headerHeight}
          modalFooterHeight={footerHeight}
          sliderDotsClassName="mt-6 h-[60px]"
        />
      </div>

      <ToolsetLoginDialog />
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
      containerClassName="flex xl:h-fit relative max-h-full flex-col rounded w-full grow items-start justify-center !bg-layer-2 md:w-[728px] md:max-w-[728px] xl:w-[1200px] xl:max-w-[1200px]"
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
