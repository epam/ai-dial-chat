import { DeploymentIcon } from '@epam/ai-dial-chat-shared';
import type {
  MenuOverlayConfig,
  SelectedEntityChip,
} from '@epam/ai-dial-conversation-input';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
} from '@epam/ai-dial-ui-kit';
import { IconBlocks } from '@tabler/icons-react';
import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FavoriteSkillsPanel } from '../../components/FavoriteSkillsPanel/FavoriteSkillsPanel';
import { SkillCatalogModal } from '../../components/SkillCatalogModal/SkillCatalogModal';
import {
  buildFavoriteSkillItem,
  type FavoriteSkillItem,
  type SkillListingEntry,
} from '../../models/favorite-skill-item';
import type {
  UseSkillSelectorOverlayOptions,
  UseSkillSelectorOverlayResult,
} from '../../models/skill-selector-overlay';

/**
 * Owns the Skills Add-menu flow: the favorites overlay with lazily resolved
 * row descriptions, the "Use skill" browse modal's open state, the skill
 * details side panel's open state, and the single selected skill shown as an
 * input chip. The host injects the listing data, favorites state, the
 * description fetch, labels, and the modal/panel components.
 */
export const useSkillSelectorOverlay = ({
  isEnabled,
  skills,
  sharedWithMe,
  publicSkills,
  favoriteIds,
  onToggleFavorite,
  fetchSkillDescription,
  labels,
  renderCatalogContent,
  detailsPanelComponent: DetailsPanelComponent,
}: UseSkillSelectorOverlayOptions): UseSkillSelectorOverlayResult => {
  const {
    addMenuLabel = 'Skills',
    backLabel = 'Back',
    catalogModalTitleLabel = 'Use skill',
    panelLabels,
  } = labels ?? {};

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [detailsSkillId, setDetailsSkillId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

  /*
   * Per-session cache of lazily resolved skill descriptions: `null` marks a
   * skill whose manifest has no description (or whose fetch failed), so it
   * never refetches this session.
   */
  const [skillDescriptions, setSkillDescriptions] = useState<
    ReadonlyMap<string, string | null>
  >(new Map());
  /*
   * Ids with a description fetch already in flight, so reopening before
   * resolution does not refetch — mirrored as state so rows re-render to
   * show the tooltip's loading spinner while their fetch runs (the state
   * copy alone would miss a second open in the same tick, e.g. StrictMode's
   * double-invoked mount effect).
   */
  const [pendingDescriptionIds, setPendingDescriptionIds] = useState<
    ReadonlySet<string>
  >(new Set());
  const pendingDescriptionIdsRef = useRef(new Set<string>());

  const allSkills = useMemo<SkillListingEntry[]>(
    () => [...skills, ...(sharedWithMe ?? []), ...(publicSkills ?? [])],
    [skills, sharedWithMe, publicSkills],
  );

  /*
   * Only skill items end up in the favorites list server-side, so matching on
   * `url` needs no nodeType filtering — folder URLs never appear in
   * `favoriteIds`.
   */
  const favoriteSkillItems = useMemo<FavoriteSkillItem[]>(
    () =>
      allSkills
        .filter((skill) => favoriteIds.has(skill.url))
        .map((skill) =>
          buildFavoriteSkillItem(
            skill,
            skillDescriptions,
            pendingDescriptionIds,
          ),
        ),
    [allSkills, favoriteIds, skillDescriptions, pendingDescriptionIds],
  );

  /*
   * Resolved from `allSkills` on every render rather than captured at
   * selection time, so a skill picked while the listing is still loading
   * (e.g. via a one-shot route state) renders its chip once the listing
   * settles.
   */
  const selectedSkill = useMemo(
    () => allSkills.find((skill) => skill.url === selectedSkillId) ?? null,
    [allSkills, selectedSkillId],
  );

  const selectSkill = useCallback((skillId: string) => {
    setSelectedSkillId(skillId);
  }, []);

  const handleRemoveSelectedSkill = useCallback(() => {
    setSelectedSkillId(null);
  }, []);

  const selectedSkillChips = useMemo<SelectedEntityChip[]>(() => {
    if (selectedSkill == null) return [];
    return [
      {
        id: selectedSkill.url,
        label: selectedSkill.name,
        icon: (
          <DeploymentIcon
            size={DIAL_ICON_SIZE.SM}
            initialsName={selectedSkill.name}
          />
        ),
        onRemove: handleRemoveSelectedSkill,
      },
    ];
  }, [selectedSkill, handleRemoveSelectedSkill]);

  /*
   * Deferred condition: DIAL Core's skill listing metadata carries no
   * description, so the manifest is fetched on a row tooltip's first open —
   * one `SKILL.md` download per hovered skill per session (an N+1 pattern).
   * A planned Core change adds `description` to `ResourceItemMetadata`; when
   * it ships, drop this fetch and its wiring — the pending state here, the
   * `isDescriptionLoading` spinner branch in `FavoriteSkillsPanel`, and the
   * `onItemTooltipOpen` callback — and let the listing populate the tooltip
   * directly.
   */
  const handleItemTooltipOpen = useCallback(
    (id: string) => {
      if (
        skillDescriptions.has(id) ||
        pendingDescriptionIdsRef.current.has(id)
      ) {
        return;
      }

      pendingDescriptionIdsRef.current.add(id);
      setPendingDescriptionIds((prev) => new Set(prev).add(id));
      fetchSkillDescription(id).then((description) => {
        pendingDescriptionIdsRef.current.delete(id);
        setPendingDescriptionIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setSkillDescriptions((prev) => new Map(prev).set(id, description));
      });
    },
    [skillDescriptions, fetchSkillDescription],
  );

  const renderOverlay = useCallback(
    (onClose: () => void): ReactNode => (
      <FavoriteSkillsPanel
        favorites={favoriteSkillItems}
        onSelect={(item) => {
          selectSkill(item.id);
          onClose();
        }}
        onToggleFavorite={onToggleFavorite}
        onBrowse={() => {
          onClose();
          setIsCatalogOpen(true);
        }}
        onViewDetails={(item) => {
          /* Closing the Add menu unmounts the overlay and its open tooltip. */
          onClose();
          setDetailsSkillId(item.id);
        }}
        onItemTooltipOpen={handleItemTooltipOpen}
        labels={panelLabels}
      />
    ),
    [
      favoriteSkillItems,
      selectSkill,
      onToggleFavorite,
      handleItemTooltipOpen,
      panelLabels,
    ],
  );

  const skillMenuOverlay = useMemo<MenuOverlayConfig>(
    () => ({
      key: 'skills',
      title: addMenuLabel,
      icon: (
        <IconBlocks
          size={BASE_ICON_SIZE}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      ),
      renderOverlay,
      backLabel,
    }),
    [addMenuLabel, backLabel, renderOverlay],
  );

  const skillCatalogModal = (
    <SkillCatalogModal
      isOpen={isCatalogOpen}
      onClose={() => setIsCatalogOpen(false)}
      onSelect={(id) => {
        selectSkill(id);
        setIsCatalogOpen(false);
      }}
      title={catalogModalTitleLabel}
      renderContent={renderCatalogContent}
    />
  );

  const skillDetailsPanel = (
    <Suspense fallback={null}>
      <DetailsPanelComponent
        skillId={detailsSkillId}
        onClose={() => setDetailsSkillId(null)}
        onUseInChat={(skillId) => {
          selectSkill(skillId);
          setDetailsSkillId(null);
        }}
      />
    </Suspense>
  );

  if (!isEnabled) {
    return {
      skillMenuOverlay: undefined,
      skillCatalogModal: null,
      skillDetailsPanel: null,
      selectedSkillChips: [],
      selectSkill: () => undefined,
    };
  }

  return {
    skillMenuOverlay,
    skillCatalogModal,
    skillDetailsPanel,
    selectedSkillChips,
    selectSkill,
  };
};
