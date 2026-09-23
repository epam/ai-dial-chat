import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import type {
  CommandMenuConfig,
  HighlightedTextRange,
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
import { matchSkillMentions } from '../../utils/skill-mention-matching';
import { getSkillFallbackName } from '../../utils/skill-url';
import { useSkillMentions } from '../useSkillMentions/useSkillMentions';

/**
 * Owns the Skills Add-menu flow: the favorites overlay, the "Use skill"
 * browse modal's open state, the skill details side panel's open state, and
 * every currently-mentioned skill tracked as a character-range anchor within
 * the composer's draft text (via `useSkillMentions`). The host injects the
 * listing data, favorites state, labels, the deployment-support signal, and
 * the modal/panel components.
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
    panelLabels,
  } = labels ?? {};

  /*
   * The entry-point gate: both the feature flag and the deployment's own
   * support must hold. Tracked mentions, their removal, and the details panel
   * survive an unsupported deployment — only the ways in are hidden — so
   * unlike `isEnabled` this never blanks the whole result.
   */
  const isSkillsEnabled = isEnabled && isSkillsSupported;

  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [detailsSkillId, setDetailsSkillId] = useState<string | null>(null);
  /*
   * The caret position captured when "Use skill" is opened from either entry
   * point (the add-menu's `onBrowse` or the slash-menu's, both of which carry
   * the triggering word's start offset) — consumed once the modal itself
   * reports a selection, since the modal's own `onSelect` carries no caret
   * argument.
   */
  const [browseCaretPosition, setBrowseCaretPosition] = useState(0);
  const [messageRevision, setMessageRevision] = useState(0);
  const [caretPositionOverride, setCaretPositionOverride] = useState<
    number | undefined
  >(undefined);

  const mentions = useSkillMentions();

  const allSkills = useMemo<SkillListingEntry[]>(
    () => [...skills, ...(sharedWithMe ?? []), ...(publicSkills ?? [])],
    [skills, sharedWithMe, publicSkills],
  );

  /*
   * Url-keyed view of `allSkills` so per-url lookups (a selection's name, a
   * history entry's name/description) are O(1) instead of a linear scan per
   * lookup per render.
   */
  const skillByUrl = useMemo<Map<string, SkillListingEntry>>(
    () => new Map(allSkills.map((skill) => [skill.url, skill])),
    [allSkills],
  );

  const resolveName = useCallback(
    (url: string) => skillByUrl.get(url)?.name ?? getSkillFallbackName(url),
    [skillByUrl],
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
   * A mention selected on a deployment that does not support skills: hosts
   * fold this into send-disabled, and every active mention's `HighlightedTextRange`
   * below also renders through `ChatSkill`'s own `isUnsupported` error styling
   * — matching the chip once the message is sent and rendered from history.
   */
  const isSkillUnsupported = mentions.anchors.length > 0 && !isSkillsSupported;

  /*
   * Live-composing mentions render through the exact same `ChatSkill`
   * component as sent history (`renderHistorySkillSegments`/
   * `renderHistorySkills` below), via `HighlightedTextRange.render` — not a
   * bespoke highlight span — so hover tooltip, "View details", and the
   * hover-only background all behave identically while typing and once sent.
   */
  const activeMentions = useMemo<HighlightedTextRange[]>(
    () =>
      mentions.anchors.map((anchor) => ({
        start: anchor.start,
        length: anchor.length,
        isUnsupported: !isSkillsSupported,
        render: () => (
          <ChatSkill
            name={anchor.name}
            path={anchor.url}
            labelClassName={historyChipLabelClassName}
            description={skillByUrl.get(anchor.url)?.description}
            isUnsupported={!isSkillsSupported}
            onViewDetails={setDetailsSkillId}
            labels={{ viewDetailsLabel: panelLabels?.viewDetailsLabel }}
          />
        ),
      })),
    [
      mentions.anchors,
      isSkillsSupported,
      skillByUrl,
      historyChipLabelClassName,
      panelLabels,
    ],
  );

  /*
   * Performs a selection: splices the mention into the tracked draft, then
   * pushes the result down through the composer's `message`/`messageRevision`
   * channel (a one-shot value push, not a continuously controlled binding —
   * see `UseSkillSelectorOverlayResult.message`'s doc) and positions the
   * caret right after the inserted `/{name}` run, plus its trailing space
   * when `insertMention` added one — so text typed immediately after a
   * selection starts a new word rather than landing before an
   * already-existing space (or gluing onto the mention when none was
   * needed).
   */
  const insertAndPush = useCallback(
    (url: string, name: string, caretPosition: number) => {
      const addedTrailingSpace = mentions.insertMention(
        url,
        name,
        caretPosition,
      );
      setMessageRevision((revision) => revision + 1);
      setCaretPositionOverride(
        caretPosition + 1 + name.length + (addedTrailingSpace ? 1 : 0),
      );
    },
    [mentions],
  );

  const resetSkillMentions = useCallback(() => {
    mentions.reset();
    setMessageRevision((revision) => revision + 1);
    setCaretPositionOverride(undefined);
  }, [mentions]);

  const seedSkillMentions = useCallback(
    (content: string, entries: RequestSkill[] | undefined) => {
      mentions.seedFromMessage(content, entries, resolveName);
      setMessageRevision((revision) => revision + 1);
      setCaretPositionOverride(undefined);
    },
    [mentions, resolveName],
  );

  /*
   * User-bubble history rendering: slices `content` into plain-text runs and
   * `ChatSkill` elements at each mention's actual position, via
   * `matchSkillMentions` (block 1). `resolvedMentions` is already ordered by
   * `start` (see that function's own scan-cursor invariant), so a single
   * left-to-right pass builds the segment array directly.
   */
  const renderHistorySkillSegments = useCallback(
    (
      content: string,
      entries: RequestSkill[] | undefined,
    ): ReactNode[] | null => {
      if (entries == null || entries.length === 0) {
        return null;
      }

      const resolvedMentions = matchSkillMentions(
        content,
        entries,
        resolveName,
      );
      const segments: ReactNode[] = [];
      let cursor = 0;

      resolvedMentions.forEach((mention) => {
        if (mention.start > cursor) {
          segments.push(content.slice(cursor, mention.start));
        }

        const skillEntry = entries[mention.skillIndex];
        const skill = skillByUrl.get(skillEntry.url);
        const name = skill?.name ?? getSkillFallbackName(skillEntry.url);

        segments.push(
          <ChatSkill
            key={`${skillEntry.url}-${mention.start}`}
            name={name}
            path={skillEntry.url}
            labelClassName={historyChipLabelClassName}
            description={skill?.description}
            onViewDetails={setDetailsSkillId}
            labels={{ viewDetailsLabel: panelLabels?.viewDetailsLabel }}
          />,
        );
        cursor = mention.start + mention.length;
      });

      if (cursor < content.length) {
        segments.push(content.slice(cursor));
      }

      return segments;
    },
    [resolveName, skillByUrl, historyChipLabelClassName, panelLabels],
  );

  /*
   * Assistant-bubble history rendering: every entry as a flat list of
   * `ChatSkill` elements, ignoring text position — assistant text is
   * model-generated markdown and never authors positioned mentions.
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
    (onClose: () => void, caretPosition: number): ReactNode => (
      <FavoriteSkillsPanel
        favorites={favoriteSkillItems}
        onSelect={(item) => {
          insertAndPush(item.id, item.name, caretPosition);
          onClose();
        }}
        onToggleFavorite={onToggleFavorite}
        onBrowse={() => {
          setBrowseCaretPosition(caretPosition);
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
    [favoriteSkillItems, insertAndPush, onToggleFavorite, panelLabels],
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
   * stale query behind while the side panel opens. `caretPosition` is the
   * triggering word's start offset — wherever in the message it was typed —
   * so the mention is spliced in at the same spot the `/query` occupied.
   */
  const commandMenu = useMemo<CommandMenuConfig | undefined>(
    () =>
      isSkillsEnabled
        ? {
            triggerPrefix: '/',
            menuLabel: addMenuLabel,
            emptyQueryHint: emptyQueryHintLabel,
            renderMenu: ({ query, caretPosition, close }) => (
              <FavoriteSkillsPanel
                favorites={favoriteSkillItems}
                searchQuery={query}
                onSelect={(item) => {
                  close({ consumeQuery: true });
                  insertAndPush(item.id, item.name, caretPosition);
                }}
                onToggleFavorite={onToggleFavorite}
                onBrowse={() => {
                  close({ consumeQuery: true });
                  setBrowseCaretPosition(caretPosition);
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
      insertAndPush,
      onToggleFavorite,
      panelLabels,
    ],
  );

  const skillCatalogModal = (
    <SkillCatalogModal
      isOpen={isCatalogOpen}
      onClose={() => setIsCatalogOpen(false)}
      onSelect={(id) => {
        insertAndPush(id, resolveName(id), browseCaretPosition);
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
      message: '',
      messageRevision: 0,
      activeMentions: [],
      onDraftChange: () => undefined,
      onBackspaceAtCaret: () => undefined,
      caretPositionOverride: undefined,
      isSkillUnsupported: false,
      selectedSkills: undefined,
      resetSkillMentions: () => undefined,
      seedSkillMentions: () => undefined,
      renderHistorySkillSegments: () => null,
      renderHistorySkills: () => null,
    };
  }

  return {
    skillMenuOverlay,
    commandMenu,
    skillCatalogModal,
    skillDetailsPanel,
    message: mentions.draft,
    messageRevision,
    activeMentions,
    onDraftChange: mentions.onDraftChange,
    onBackspaceAtCaret: mentions.onBackspaceAtCaret,
    caretPositionOverride,
    isSkillUnsupported,
    selectedSkills: mentions.orderedSkills,
    resetSkillMentions,
    seedSkillMentions,
    renderHistorySkillSegments,
    renderHistorySkills,
  };
};
