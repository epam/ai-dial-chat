import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import { isSkillSelectionUnsupported } from '@epam/ai-dial-chat-shared';
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
 * Owns the Skills Add-menu flow: the favorites overlay, the "Use skill"
 * browse modal's open state, the skill details side panel's open state, and
 * the single selected skill rendered as the input's inline `ChatSkill`
 * element. The host injects the listing data, favorites state, labels, the
 * deployment-support signal, and the modal/panel components.
 */
export const useSkillSelectorOverlay = ({
  isEnabled,
  isSkillsSupported,
  skills,
  sharedWithMe,
  publicSkills,
  favoriteIds,
  onToggleFavorite,
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
    unsupportedTooltipLabel = 'Selected model does not support skills. Remove the skill or select different model to proceed.',
    panelLabels,
  } = labels ?? {};

  /*
   * The entry-point gate: both the feature flag and the deployment's own
   * support must hold. A selected skill, its removal gesture, and the
   * details panel survive an unsupported deployment — only the ways in are
   * hidden — so unlike `isEnabled` this never blanks the whole result.
   */
  const isSkillsEnabled = isEnabled && isSkillsSupported;

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [detailsSkillId, setDetailsSkillId] = useState<string | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);

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
        .map((skill) => buildFavoriteSkillItem(skill)),
    [allSkills, favoriteIds],
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
        : (skillByUrl.get(selectedSkillId) ?? {
            url: selectedSkillId,
            name: selectedSkillId,
          }),
    [skillByUrl, selectedSkillId],
  );

  /*
   * A skill selected on a deployment that does not support skills: the chip
   * renders in its error state and hosts fold this into send-disabled.
   */
  const isSkillUnsupported = isSkillSelectionUnsupported(
    selectedSkillId,
    isSkillsSupported,
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
   * The selected skill's inline form: the shared tooltip content, with the
   * listing-sourced description — or, while the deployment does not support
   * skills, the error state (error-colored label, message-only tooltip).
   * Memoized so the element's identity stays stable across unrelated
   * re-renders (streaming) and the input hosting it as `inlineStartSlot` is
   * not needlessly re-rendered. The element carries no remove control —
   * removal is the input's Backspace-at-start gesture via
   * `removeSelectedSkill` (wired to `onInlineStartRemove`). "View details"
   * opens the same side panel the rows' action opens.
   */
  const selectedSkillElement = useMemo<ReactNode>(
    () =>
      selectedSkill == null ? null : (
        <ChatSkill
          name={selectedSkill.name}
          path={selectedSkill.url}
          description={selectedSkill.description}
          isUnsupported={isSkillUnsupported}
          onViewDetails={setDetailsSkillId}
          labels={{
            viewDetailsLabel: panelLabels?.viewDetailsLabel,
            unsupportedTooltipLabel,
          }}
        />
      ),
    [selectedSkill, isSkillUnsupported, panelLabels, unsupportedTooltipLabel],
  );

  /*
   * History display: one `ChatSkill` per `custom_content.skills` entry,
   * sharing the rows' "View details" panel. The name and description come
   * from the listing pools matched on the entry's url; a url no pool carries
   * (e.g. a skill the viewer cannot read) falls back to its last non-empty
   * segment with no description. The label class is host-supplied because
   * the chip renders beside the bubble's first text line and its height
   * should match that line.
   */
  const renderHistorySkills = useCallback(
    (entries: RequestSkill[] | undefined): ReactNode => {
      if (entries == null || entries.length === 0) {
        return null;
      }

      return entries.map((entry) => {
        const skill = skillByUrl.get(entry.url);
        const name = skill?.name ?? getSkillFallbackName(entry.url);

        return (
          <ChatSkill
            key={entry.url}
            name={name}
            path={entry.url}
            labelClassName={historyChipLabelClassName}
            description={skill?.description}
            onViewDetails={setDetailsSkillId}
            labels={{ viewDetailsLabel: panelLabels?.viewDetailsLabel }}
          />
        );
      });
    },
    [skillByUrl, historyChipLabelClassName, panelLabels],
  );

  const renderOverlay = useCallback(
    (onClose: () => void): ReactNode => (
      <FavoriteSkillsPanel
        favorites={favoriteSkillItems}
        /* The Add menu mounts overlays inside a `role="menu"` container. */
        isMenu
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
        labels={panelLabels}
      />
    ),
    [favoriteSkillItems, selectSkill, onToggleFavorite, panelLabels],
  );

  const skillMenuOverlay = useMemo<MenuOverlayConfig | undefined>(
    () =>
      isSkillsEnabled
        ? {
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
          }
        : undefined,
    [isSkillsEnabled, addMenuLabel, backLabel, renderOverlay],
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
      isSkillsEnabled
        ? {
            triggerPrefix: '/',
            menuLabel: addMenuLabel,
            emptyQueryHint: emptyQueryHintLabel,
            renderMenu: ({ query, close, listboxId, activeOptionId }) => (
              <FavoriteSkillsPanel
                favorites={favoriteSkillItems}
                searchQuery={query}
                listboxId={listboxId}
                activeOptionId={activeOptionId}
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
                labels={panelLabels}
              />
            ),
          }
        : undefined,
    [
      isSkillsEnabled,
      addMenuLabel,
      emptyQueryHintLabel,
      favoriteSkillItems,
      selectSkill,
      onToggleFavorite,
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
      isSkillUnsupported: false,
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
    isSkillUnsupported,
    selectSkill,
    removeSelectedSkill,
    renderHistorySkills,
  };
};
