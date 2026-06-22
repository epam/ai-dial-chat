import { IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  PublishedWithMeFilter,
  SharedWithMeFilters,
} from '@/src/utils/app/search';

import { FeatureType } from '@/src/types/common';
import { FolderInterface } from '@/src/types/folder';
import { ModalState } from '@/src/types/modal';
import { EntityFilters } from '@/src/types/search';
import { Translation } from '@/src/types/translation';

import { PromptsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { MarketplaceI18nKeys, PromptBarI18nKeys } from '@/src/constants/i18n';
import {
  ORGANIZATION_SECTION_NAME,
  PINNED_PROMPTS_SECTION_NAME,
  RECENT_PROMPTS_SECTION_NAME,
  SHARED_WITH_ME_SECTION_NAME,
} from '@/src/constants/sections';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { FolderRow } from '@/src/components/Common/FolderRow';
import { Modal } from '@/src/components/Common/Modal';
import { PromptRow } from '@/src/components/Common/PromptRow';

import { NoData } from '../NoData';

import {
  DialLinkButton,
  DialPrimaryButton,
  DialSearch,
} from '@epam/ai-dial-ui-kit';

interface SkillsSectionProps {
  sectionName: string;
  filters: EntityFilters;
  searchTerm: string;
  allFolders: FolderInterface[];
  selectedIds: string[];
  openedFoldersIds: string[];
  openByDefault?: boolean;
  skipFolders?: boolean;
  skipRootPrompts?: boolean;
  scrollToId?: string | null;
  onToggle: (id: string) => void;
  onToggleFolder: (descendantIds: string[]) => void;
  onClickFolder: (folderId: string) => void;
  onScrollRef: (id: string, el: HTMLDivElement | null) => void;
}

const SkillsSection = ({
  sectionName,
  filters,
  searchTerm,
  allFolders,
  selectedIds,
  openedFoldersIds,
  skipFolders = false,
  openByDefault = true,
  skipRootPrompts = false,
  scrollToId,
  onToggle,
  onToggleFolder,
  onClickFolder,
  onScrollRef,
}: SkillsSectionProps) => {
  const rootFoldersSelector = useMemo(
    () => PromptsSelectors.selectFilteredFolders(filters, searchTerm),
    [filters, searchTerm],
  );
  const rootFolders = useAppSelector(rootFoldersSelector);
  const rootPromptsSelector = useMemo(
    () => PromptsSelectors.selectFilteredPrompts(filters, searchTerm),
    [filters, searchTerm],
  );
  const rootPrompts = useAppSelector(rootPromptsSelector);
  const folderFilters = useMemo(
    () => ({
      searchFilter: filters.searchFilter,
      versionFilter: filters.versionFilter,
    }),
    [filters.searchFilter, filters.versionFilter],
  );
  const treePromptsSelector = useMemo(
    () => PromptsSelectors.selectFilteredPrompts(folderFilters, searchTerm),
    [folderFilters, searchTerm],
  );
  const treePrompts = useAppSelector(treePromptsSelector);

  if (
    (rootFolders.length === 0 || skipFolders) &&
    (skipRootPrompts || rootPrompts.length === 0)
  ) {
    return null;
  }

  return (
    <CollapsibleSection name={sectionName} openByDefault={openByDefault}>
      {!skipFolders && (
        <div className="flex flex-col gap-0.5">
          {rootFolders.map((folder) => (
            <FolderRow
              key={folder.id}
              folder={folder}
              allFolders={allFolders}
              allItems={treePrompts}
              level={0}
              selectedItemIds={selectedIds}
              openedFoldersIds={openedFoldersIds}
              itemComponent={PromptRow}
              onToggleItem={onToggle}
              onToggleFolder={onToggleFolder}
              onClickFolder={onClickFolder}
            />
          ))}
        </div>
      )}
      {!skipRootPrompts && rootPrompts.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {rootPrompts.map((p) => (
            <PromptRow
              key={p.id}
              ref={
                scrollToId === p.id
                  ? (el: HTMLDivElement | null) => onScrollRef(p.id, el)
                  : null
              }
              item={p}
              level={0}
              isSelected={selectedIds.includes(p.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
};

interface AgentSkillsModalProps {
  initialSelectedIds: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

export const AgentSkillsModal = ({
  initialSelectedIds,
  onClose,
  onConfirm,
}: AgentSkillsModalProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const preCreateSnapshotRef = useRef<Set<string> | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [openedFoldersIds, setOpenedFoldersIds] = useState<string[]>([]);
  const [scrollToId, setScrollToId] = useState<string | null>(null);

  const myItemsFilters = useAppSelector(PromptsSelectors.selectMyItemsFilters);
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);
  const isSharingEnabled = useAppSelector((state) =>
    SettingsSelectors.isSharingEnabled(state, FeatureType.Prompt),
  );
  const isPublishingEnabled = useAppSelector((state) =>
    SettingsSelectors.selectIsPublishingEnabled(state, FeatureType.Prompt),
  );
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const rootFoldersSelector = useMemo(
    () => PromptsSelectors.selectFilteredFolders(myItemsFilters, searchTerm),
    [myItemsFilters, searchTerm],
  );
  const rootFolders = useAppSelector(rootFoldersSelector);

  const isEmpty = rootFolders.length === 0 && allPrompts.length === 0;

  useEffect(() => {
    if (!preCreateSnapshotRef.current) return;

    const newId = allPrompts.find(
      (p) => !preCreateSnapshotRef.current!.has(p.id),
    )?.id;
    if (!newId) return;

    preCreateSnapshotRef.current = null;
    setSelectedIds((prev) => (prev.includes(newId) ? prev : [...prev, newId]));
    setScrollToId(newId);
  }, [allPrompts]);

  const handleScrollRef = useCallback(
    (_id: string, el: HTMLDivElement | null) => {
      if (!el) return;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setScrollToId(null);
    },
    [],
  );

  useEffect(() => {
    dispatch(PromptsActions.uploadPromptsWithFoldersRecursive());
  }, [dispatch]);

  const handleTogglePrompt = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((itemId) => itemId !== id)
        : [...prev, id],
    );
  }, []);

  const handleToggleFolder = useCallback((descendantIds: string[]) => {
    if (descendantIds.length === 0) {
      return;
    }

    setSelectedIds((prev) => {
      const allSelected = descendantIds.every((id) => prev.includes(id));

      if (allSelected) {
        return prev.filter((id) => !descendantIds.includes(id));
      }

      return [...prev, ...descendantIds];
    });
  }, []);

  const handleClickFolder = useCallback((folderId: string) => {
    setOpenedFoldersIds((prev) =>
      prev.includes(folderId)
        ? prev.filter((id) => id !== folderId)
        : [...prev, folderId],
    );
  }, []);

  const handleCreatePrompt = useCallback(() => {
    preCreateSnapshotRef.current = new Set(allPrompts.map((p) => p.id));
    dispatch(PromptsActions.setIsNewPromptCreating(true));
    dispatch(
      PromptsActions.setIsPromptModalOpen({
        isOpen: true,
        isInitModeEdit: true,
        isQuickAppEditPrompt: true,
      }),
    );
  }, [dispatch, allPrompts]);

  const handleConfirm = useCallback(() => {
    onConfirm(selectedIds);
  }, [selectedIds, onConfirm]);

  const sections = useMemo(
    () =>
      [
        {
          sectionName: ORGANIZATION_SECTION_NAME,
          filters: PublishedWithMeFilter,
          hidden: !isPublishingEnabled,
        },
        {
          sectionName: SHARED_WITH_ME_SECTION_NAME,
          filters: SharedWithMeFilters,
          hidden: !isSharingEnabled,
        },
        {
          sectionName: PINNED_PROMPTS_SECTION_NAME,
          filters: myItemsFilters,
          openByDefault: true,
          skipRootPrompts: true,
          hidden: false,
        },
        {
          sectionName: RECENT_PROMPTS_SECTION_NAME,
          filters: myItemsFilters,
          openByDefault: true,
          skipFolders: true,
          hidden: false,
        },
      ].filter((section) => !section.hidden),
    [myItemsFilters, isPublishingEnabled, isSharingEnabled],
  );

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      dataQa="agent-skills-modal"
      containerClassName="flex flex-col relative max-h-[80vh] w-full rounded !bg-layer-2 md:w-[560px] md:max-w-[560px]"
      onClose={onClose}
    >
      <h3 className="px-6 pb-4 pt-6 text-base font-semibold">
        {t(MarketplaceI18nKeys.AddAgentSkills)}
      </h3>

      <div className="px-6 pb-2">
        <DialSearch
          placeholder={t(MarketplaceI18nKeys.SearchMarketplace)}
          value={searchTerm}
          onChange={setSearchTerm}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[72px]">
        {isEmpty ? (
          <div className="py-10">
            <NoData />
          </div>
        ) : (
          <div className="flex w-full flex-col gap-0.5 divide-y divide-tertiary">
            {sections.map((props) => (
              <SkillsSection
                {...props}
                key={props.sectionName}
                searchTerm={searchTerm}
                allFolders={allFolders}
                selectedIds={selectedIds}
                scrollToId={scrollToId}
                onToggle={handleTogglePrompt}
                onToggleFolder={handleToggleFolder}
                openedFoldersIds={openedFoldersIds}
                onClickFolder={handleClickFolder}
                onScrollRef={handleScrollRef}
              />
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-0 flex w-full justify-between border-t border-tertiary bg-layer-2 px-6 py-[14px]">
        <DialLinkButton
          iconBefore={<IconPlus size={18} />}
          label={t(PromptBarI18nKeys.CreatePrompt)}
          onClick={handleCreatePrompt}
        />
        <DialPrimaryButton
          label={t(MarketplaceI18nKeys.SelectAgentSkills)}
          onClick={handleConfirm}
          disabled={selectedIds.length === 0}
        />
      </div>
    </Modal>
  );
};
