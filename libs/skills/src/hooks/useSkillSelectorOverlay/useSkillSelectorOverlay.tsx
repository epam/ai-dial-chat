import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import type {
  CommandMenuConfig,
  MenuOverlayConfig,
} from '@epam/ai-dial-conversation-input';
import { BASE_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconBlocks } from '@tabler/icons-react';
import {
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChatSkill } from '../../components/ChatSkill/ChatSkill';
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
import { getSkillFallbackName } from '../../utils/skill-url';

/**
 * Owns the Skills Add-menu flow: the favorites overlay with lazily resolved
 * row descriptions, the "Use skill" browse modal's open state, the skill
 * details side panel's open state, and the single selected skill rendered as
 * the input's inline `ChatSkill` element. The host injects the listing data,
 * favorites state, the description fetch, labels, and the modal/panel
 * components.
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
  historyChipLabelClassName,
  renderCatalogContent,
  detailsPanelComponent: DetailsPanelComponent,
}: UseSkillSelectorOverlayOptions): UseSkillSelectorOverlayResult => {
  const {
    addMenuLabel = 'Skills',
    backLabel = 'Back',
    catalogModalTitleLabel = 'Use skill',
    emptyQueryHintLabel = 'Type to filter',
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
   * Url-keyed view of `allSkills` so per-url lookups (the selected skill,
   * history entries) are O(1) instead of a linear scan per entry per render.
   */
  const skillByUrl = useMemo<Map<string, SkillListingEntry>>(
    () => new Map(allSkills.map((skill) => [skill.url, skill])),
    [allSkills],
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
   * (e.g. via a one-shot route state) renders once the listing settles.
   */
  const selectedSkill = useMemo(
    () =>
      selectedSkillId == null
        ? null
        : (skillByUrl.get(selectedSkillId) ?? null),
    [skillByUrl, selectedSkillId],
  );

  const selectSkill = useCallback((skillId: string) => {
    setSelectedSkillId(skillId);
  }, []);

  const removeSelectedSkill = useCallback(() => {
    setSelectedSkillId(null);
  }, []);

  /*
   * The selection id is the skill's resource URL, so it is exposed as the
   * send-time path directly — even while the listing is still loading and
   * `selectedSkill` has not resolved yet (the id came from a selection entry
   * point, which always receives resource URLs).
   */
  const selectedSkillPath = selectedSkillId;

  /*
   * The send-time `custom_content.skills` payload: a single `{ url }` entry
   * while a skill is selected, `undefined` otherwise so the field is omitted
   * from the message entirely. Memoized on the selection id so hosts can hold
   * it in `useCallback`/`memo` deps without the identity churning on every
   * render (e.g. every streaming token re-rendering the conversation view).
   */
  const selectedSkills = useMemo<RequestSkill[] | undefined>(
    () => (selectedSkillId == null ? undefined : [{ url: selectedSkillId }]),
    [selectedSkillId],
  );

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

  /*
   * The selected skill's inline form: the shared tooltip content and the same
   * lazy description fetch as the favorites rows. Memoized so the element's
   * identity stays stable across unrelated re-renders (streaming) and the
   * input hosting it as `inlineStartSlot` is not needlessly re-rendered. The
   * element carries no remove control — removal is the input's
   * Backspace-at-start gesture via `removeSelectedSkill` (wired to
   * `onInlineStartRemove`). "View details" opens the same side panel the
   * rows' action opens.
   */
  const selectedSkillElement = useMemo<ReactNode>(
    () =>
      selectedSkill == null ? null : (
        <ChatSkill
          name={selectedSkill.name}
          path={selectedSkill.url}
          description={skillDescriptions.get(selectedSkill.url) ?? undefined}
          isDescriptionLoading={pendingDescriptionIds.has(selectedSkill.url)}
          onTooltipOpen={handleItemTooltipOpen}
          onViewDetails={setDetailsSkillId}
          labels={{ viewDetailsLabel: panelLabels?.viewDetailsLabel }}
        />
      ),
    [
      selectedSkill,
      skillDescriptions,
      pendingDescriptionIds,
      handleItemTooltipOpen,
      panelLabels,
    ],
  );

  /*
   * History display: one `ChatSkill` per `custom_content.skills` entry,
   * sharing the rows' description cache, first-open fetch, and "View details"
   * panel. The name comes from the listing pools matched on the entry's url;
   * a url no pool carries (e.g. a skill the viewer cannot read) falls back to
   * its last non-empty segment, and its description fetch degrades silently
   * per the cache's rules. The label class is host-supplied because the chip
   * renders beside the bubble's first text line and its height should match
   * that line.
   */
  const renderHistorySkills = useCallback(
    (entries: RequestSkill[] | undefined): ReactNode => {
      if (entries == null || entries.length === 0) {
        return null;
      }

      return entries.map((entry) => {
        const name =
          skillByUrl.get(entry.url)?.name ?? getSkillFallbackName(entry.url);

        return (
          <ChatSkill
            key={entry.url}
            name={name}
            path={entry.url}
            labelClassName={historyChipLabelClassName}
            description={skillDescriptions.get(entry.url) ?? undefined}
            isDescriptionLoading={pendingDescriptionIds.has(entry.url)}
            onTooltipOpen={handleItemTooltipOpen}
            onViewDetails={setDetailsSkillId}
            labels={{ viewDetailsLabel: panelLabels?.viewDetailsLabel }}
          />
        );
      });
    },
    [
      skillByUrl,
      historyChipLabelClassName,
      skillDescriptions,
      pendingDescriptionIds,
      handleItemTooltipOpen,
      panelLabels,
    ],
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

  /*
   * The slash-command menu: same favorites panel as the Add-menu overlay, but
   * in search mode over the typed query. Every action consumes the `/query`
   * text from the textarea first (`close({ consumeQuery: true })`), so it is
   * never sent — including "View details", which would otherwise leave a
   * stale query behind while the side panel opens.
   */
  const commandMenu = useMemo<CommandMenuConfig | undefined>(
    () =>
      isEnabled
        ? {
            triggerPrefix: '/',
            menuLabel: addMenuLabel,
            emptyQueryHint: emptyQueryHintLabel,
            renderMenu: ({ query, close }) => (
              <FavoriteSkillsPanel
                favorites={favoriteSkillItems}
                searchQuery={query}
                onSelect={(item) => {
                  close({ consumeQuery: true });
                  selectSkill(item.id);
                }}
                onToggleFavorite={onToggleFavorite}
                onBrowse={() => {
                  close({ consumeQuery: true });
                  setIsCatalogOpen(true);
                }}
                onViewDetails={(item) => {
                  close({ consumeQuery: true });
                  setDetailsSkillId(item.id);
                }}
                onItemTooltipOpen={handleItemTooltipOpen}
                labels={panelLabels}
              />
            ),
          }
        : undefined,
    [
      isEnabled,
      addMenuLabel,
      emptyQueryHintLabel,
      favoriteSkillItems,
      selectSkill,
      onToggleFavorite,
      handleItemTooltipOpen,
      panelLabels,
    ],
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

  /*
   * Information-only by design: the panel a "View details" action opens shows
   * the skill's details and nothing else — selecting a skill belongs to the
   * rows, the slash menu, and the browse modal, and favorite toggling to the
   * rows. The host's panel component renders `DetailsPanel` read-only.
   */
  const skillDetailsPanel = (
    <Suspense fallback={null}>
      <DetailsPanelComponent
        skillId={detailsSkillId}
        onClose={() => setDetailsSkillId(null)}
      />
    </Suspense>
  );

  if (!isEnabled) {
    return {
      skillMenuOverlay: undefined,
      commandMenu: undefined,
      skillCatalogModal: null,
      skillDetailsPanel: null,
      selectedSkillElement: null,
      selectedSkillPath: null,
      selectedSkills: undefined,
      selectSkill: () => undefined,
      removeSelectedSkill: () => undefined,
      renderHistorySkills: () => null,
    };
  }

  return {
    skillMenuOverlay,
    commandMenu,
    skillCatalogModal,
    skillDetailsPanel,
    selectedSkillElement,
    selectedSkillPath,
    selectedSkills,
    selectSkill,
    removeSelectedSkill,
    renderHistorySkills,
  };
};
