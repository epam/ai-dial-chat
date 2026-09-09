import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import {
  FavoriteEntityType,
  fetchSkillDescription,
} from '@epam/ai-dial-chat-hooks';
import { DeploymentIcon } from '@epam/ai-dial-chat-shared';
import type {
  MenuOverlayConfig,
  SelectedEntityChip,
} from '@epam/ai-dial-conversation-input';
import type { FavoriteSkillItem } from '@epam/ai-dial-skills';
import {
  BASE_ICON_SIZE,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
} from '@epam/ai-dial-ui-kit';
import { IconBlocks } from '@tabler/icons-react';
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  NavigationI18nKeys,
  SkillSelectorI18nKeys,
} from '../../constants/translation-keys';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useSkills } from '../../context/SkillsContext';
import { downloadSkillFile } from '../../server-api/skills.api';

const SkillSelectorOverlay = lazy(() => import('./SkillSelectorOverlay'));

const SkillCatalogModal = lazy(async () => {
  const module = await import('./SkillCatalogModal');
  return { default: module.default };
});

const SkillDetailsPanelContainer = lazy(() =>
  import('./SkillDetailsPanelContainer'),
);

/*
 * Skill metadata carries no description — the manifest does, and it is read
 * lazily on the row tooltip's first open — so the description is threaded in
 * from the host's resolved cache, not the listing.
 */
const buildFavoriteSkillItem = (
  skill: SkillMetadataItemDto,
  descriptions: ReadonlyMap<string, string | null>,
  pendingIds: ReadonlySet<string>,
): FavoriteSkillItem => ({
  id: skill.url,
  name: skill.name,
  /* `null` (fetch failed / manifest has none) reads the same as not-yet-resolved: no tooltip paragraph. */
  description: descriptions.get(skill.url) ?? undefined,
  isDescriptionLoading: pendingIds.has(skill.url),
});

interface UseSkillSelectorOverlayResult {
  /**
   * The Skills entry for the `menuOverlays` prop of
   * `ConversationInput`/`Input`. `undefined` while the `skillUsageEnabled`
   * feature flag is off: the host omits the entry entirely when this is
   * `undefined`, so a stub renderer would leave the menu item in place with
   * nothing behind it.
   */
  skillMenuOverlay?: MenuOverlayConfig;
  /** Render this element at a stable level outside the popover (e.g. next to the input). */
  skillCatalogModal: ReactNode;
  /**
   * The skill details side panel opened by a row tooltip's "View details".
   * `null` while the `skillUsageEnabled` feature flag is off.
   */
  skillDetailsPanel: ReactNode;
  /**
   * The selected skill as input chip data — at most one entry, replaced on
   * every selection. Empty while the flag is off or nothing is selected.
   */
  selectedSkillChips: SelectedEntityChip[];
  /** Selects a skill by its resource URL (`skills/{bucket}/{path}`), replacing any prior selection. */
  selectSkill: (skillId: string) => void;
}

/**
 * Owns the Skills Add-menu flow: the favorites overlay with lazily resolved
 * row descriptions, the "Use skill" browse modal, the skill details side
 * panel, and the single selected skill shown as an input chip. Gated behind
 * the `skillUsageEnabled` feature flag.
 */
export function useSkillSelectorOverlay(): UseSkillSelectorOverlayResult {
  const isSkillUsageEnabled = useFeatureFlag('skillUsageEnabled');
  const { t } = useTranslation();
  const { skills, sharedWithMe, publicSkills } = useSkills();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

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

  const allSkills = useMemo(
    () => [...skills, ...(sharedWithMe ?? []), ...publicSkills],
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
          buildFavoriteSkillItem(skill, skillDescriptions, pendingDescriptionIds),
        ),
    [allSkills, favoriteIds, skillDescriptions, pendingDescriptionIds],
  );

  /*
   * Resolved from `allSkills` on every render rather than captured at
   * selection time, so a skill picked while the listing is still loading
   * (e.g. via the catalog's one-shot router state) renders its chip once the
   * listing settles.
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
   * `isDescriptionLoading` spinner branch in `libs/skills`, and the
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
      fetchSkillDescription({ downloadSkillFile }, id).then((description) => {
        pendingDescriptionIdsRef.current.delete(id);
        setPendingDescriptionIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setSkillDescriptions((prev) => new Map(prev).set(id, description));
      });
    },
    [skillDescriptions],
  );

  const renderOverlay = useCallback(
    (onClose: () => void): ReactNode => (
      <Suspense fallback={null}>
        <SkillSelectorOverlay
          favorites={favoriteSkillItems}
          onSelect={(item) => {
            selectSkill(item.id);
            onClose();
          }}
          onToggleFavorite={(id) =>
            toggleFavorite(id, false, FavoriteEntityType.Skill)
          }
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
        />
      </Suspense>
    ),
    [favoriteSkillItems, selectSkill, toggleFavorite, handleItemTooltipOpen],
  );

  const skillMenuOverlay = useMemo<MenuOverlayConfig>(
    () => ({
      key: 'skills',
      title: t(SkillSelectorI18nKeys.AddMenuLabel),
      icon: (
        <IconBlocks
          size={BASE_ICON_SIZE}
          aria-hidden
          stroke={DIAL_KIT_ICON_STROKE}
        />
      ),
      renderOverlay,
      backLabel: t(NavigationI18nKeys.Back),
    }),
    [t, renderOverlay],
  );

  const skillCatalogModal = (
    <Suspense fallback={null}>
      <SkillCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelect={(id) => {
          selectSkill(id);
          setIsCatalogOpen(false);
        }}
      />
    </Suspense>
  );

  const skillDetailsPanel = (
    <Suspense fallback={null}>
      <SkillDetailsPanelContainer
        skillId={detailsSkillId}
        onClose={() => setDetailsSkillId(null)}
        onUseInChat={(skillId) => {
          selectSkill(skillId);
          setDetailsSkillId(null);
        }}
      />
    </Suspense>
  );

  if (!isSkillUsageEnabled) {
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
}
