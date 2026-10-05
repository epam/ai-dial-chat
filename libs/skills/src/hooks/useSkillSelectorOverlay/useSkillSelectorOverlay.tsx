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
import { SkillUnresolvedReason } from '../../types/skill-unresolved-reason';
import { matchSkillMentions } from '../../utils/skill-mention-matching';
import { findSlashQueryAtCaret } from '../../utils/skill-mention-tracking';
import { getSkillFallbackName, getSkillUrlBucket } from '../../utils/skill-url';
import { useSkillMentions } from '../useSkillMentions/useSkillMentions';

/** `Deleted` when the url's own bucket, `NotShared` otherwise. */
const resolveUnresolvedReason = (
  url: string,
  viewerBucket: string,
): SkillUnresolvedReason =>
  getSkillUrlBucket(url) === viewerBucket
    ? SkillUnresolvedReason.Deleted
    : SkillUnresolvedReason.NotShared;

/* Shared with the slash command menu's own `CommandMenuConfig.triggerPrefix` below. */
const SKILL_TRIGGER_PREFIX = '/';

/**
 * Owns the Skills Add-menu flow: the favorites overlay, the "Use skill"
 * browse modal's open state, the skill details side panel's open state, and
 * every currently-mentioned skill tracked as a character-range anchor within
 * the composer's draft text (via `useSkillMentions`). The host injects the
 * listing data, favorites state, labels, the deployment-support signal, and
 * the modal/panel components.
 */
export const useSkillSelectorOverlay = ({
  isSkillsSupported,
  skills,
  sharedWithMe,
  publicSkills,
  favoriteIds,
  viewerBucket,
  onToggleFavorite,
  labels,
  historyChipLabelClassName,
  activeMentionDetailsTrigger,
  historyDetailsTrigger,
  renderCatalogContent,
  detailsPanelComponent: DetailsPanelComponent,
}: UseSkillSelectorOverlayOptions): UseSkillSelectorOverlayResult => {
  const {
    addMenuLabel = 'Skills',
    backLabel = 'Back',
    catalogModalTitleLabel = 'Use skill',
    emptyQueryHintLabel = 'Type to filter',
    deletedTooltipLabel,
    notSharedTooltipLabel,
    unsupportedTooltipLabel,
    panelLabels,
  } = labels ?? {};

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
  /*
   * Consumed query or mention to restore on cancel. A ref lets selection
   * discard it before the catalog calls onClose in the same event.
   */
  const browseRestoreTextRef = useRef<{
    position: number;
    text: string;
    mentionUrl?: string;
  } | null>(null);
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
            detailsTrigger={activeMentionDetailsTrigger}
            onViewDetails={setDetailsSkillId}
            labels={{
              viewDetailsLabel: panelLabels?.viewDetailsLabel,
              unsupportedTooltipLabel,
            }}
          />
        ),
      })),
    [
      mentions.anchors,
      isSkillsSupported,
      skillByUrl,
      historyChipLabelClassName,
      activeMentionDetailsTrigger,
      panelLabels,
      unsupportedTooltipLabel,
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

  /*
   * The Add-menu's own selection path (`renderOverlay` below) has no
   * autocomplete state of its own — `caretPosition` is just wherever the
   * caret sat when the `+` menu opened, which may or may not be sitting in a
   * typed `/query` the user was filtering the slash menu with before
   * clicking away from it. If it is, strip that raw text first so the
   * mention is inserted in its place instead of being inserted next to text
   * that would otherwise still be sent — mirroring the slash menu's own
   * `close({ consumeQuery: true })`. Returns the position the mention should
   * be inserted at: the query's own start when one was consumed, `caretPosition`
   * unchanged otherwise.
   */
  const consumeQueryAtCaret = useCallback(
    (caretPosition: number): number => {
      const query = findSlashQueryAtCaret(
        mentions.draft,
        caretPosition,
        SKILL_TRIGGER_PREFIX,
      );
      if (query == null) return caretPosition;

      mentions.onDraftChange(
        mentions.draft.slice(0, query.start) + mentions.draft.slice(query.end),
      );
      return query.start;
    },
    [mentions],
  );

  /* Non-mutating read of the same run `consumeQueryAtCaret`/`close({ consumeQuery: true })` would remove, plus its mention url when that run is an already-tracked anchor rather than unconfirmed text — see the skill-input-attachment spec's "Slash command dropdown" requirement. */
  const peekQueryAtCaret = useCallback(
    (
      caretPosition: number,
    ): { position: number; text: string; mentionUrl?: string } | undefined => {
      const query = findSlashQueryAtCaret(
        mentions.draft,
        caretPosition,
        SKILL_TRIGGER_PREFIX,
      );
      if (query == null) return undefined;

      const matchedAnchor = mentions.anchors.find(
        (anchor) =>
          anchor.start === query.start &&
          anchor.start + anchor.length === query.end,
      );
      return {
        position: query.start,
        text: mentions.draft.slice(query.start, query.end),
        mentionUrl: matchedAnchor?.url,
      };
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
        const unresolvedReason =
          skill == null
            ? resolveUnresolvedReason(skillEntry.url, viewerBucket)
            : undefined;

        segments.push(
          <ChatSkill
            key={`${skillEntry.url}-${mention.start}`}
            name={name}
            path={skillEntry.url}
            labelClassName={historyChipLabelClassName}
            description={skill?.description}
            unresolvedReason={unresolvedReason}
            detailsTrigger={historyDetailsTrigger}
            onViewDetails={setDetailsSkillId}
            labels={{
              viewDetailsLabel: panelLabels?.viewDetailsLabel,
              deletedTooltipLabel,
              notSharedTooltipLabel,
            }}
          />,
        );
        cursor = mention.start + mention.length;
      });

      if (cursor < content.length) {
        segments.push(content.slice(cursor));
      }

      return segments;
    },
    [
      resolveName,
      skillByUrl,
      historyChipLabelClassName,
      historyDetailsTrigger,
      panelLabels,
      viewerBucket,
      deletedTooltipLabel,
      notSharedTooltipLabel,
    ],
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
        const unresolvedReason =
          skill == null
            ? resolveUnresolvedReason(entry.url, viewerBucket)
            : undefined;

        return (
          <ChatSkill
            key={entry.url}
            name={name}
            path={entry.url}
            labelClassName={historyChipLabelClassName}
            description={skill?.description}
            unresolvedReason={unresolvedReason}
            detailsTrigger={historyDetailsTrigger}
            onViewDetails={setDetailsSkillId}
            labels={{
              viewDetailsLabel: panelLabels?.viewDetailsLabel,
              deletedTooltipLabel,
              notSharedTooltipLabel,
            }}
          />
        );
      });
    },
    [
      skillByUrl,
      historyChipLabelClassName,
      historyDetailsTrigger,
      panelLabels,
      viewerBucket,
      deletedTooltipLabel,
      notSharedTooltipLabel,
    ],
  );

  const renderOverlay = useCallback(
    (onClose: () => void, caretPosition: number): ReactNode => (
      <FavoriteSkillsPanel
        favorites={favoriteSkillItems}
        /* The Add menu mounts overlays inside a `role="menu"` container. */
        isMenu
        onSelect={(item) => {
          insertAndPush(item.id, item.name, consumeQueryAtCaret(caretPosition));
          onClose();
        }}
        onToggleFavorite={onToggleFavorite}
        onBrowse={() => {
          const strayQuery = peekQueryAtCaret(caretPosition);
          const position = consumeQueryAtCaret(caretPosition);
          setBrowseCaretPosition(position);
          browseRestoreTextRef.current = strayQuery ?? null;
          onClose();
          setIsCatalogOpen(true);
        }}
        onViewDetails={(item) => {
          consumeQueryAtCaret(caretPosition);
          /* Closing the Add menu unmounts the overlay and its open tooltip. */
          onClose();
          setDetailsSkillId(item.id);
        }}
        labels={panelLabels}
      />
    ),
    [
      favoriteSkillItems,
      insertAndPush,
      consumeQueryAtCaret,
      peekQueryAtCaret,
      onToggleFavorite,
      panelLabels,
    ],
  );

  const skillMenuOverlay = useMemo<MenuOverlayConfig | undefined>(
    () =>
      isSkillsSupported
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
    [isSkillsSupported, addMenuLabel, backLabel, renderOverlay],
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
      isSkillsSupported
        ? {
            triggerPrefix: SKILL_TRIGGER_PREFIX,
            menuLabel: addMenuLabel,
            emptyQueryHint: emptyQueryHintLabel,
            renderMenu: ({
              query,
              caretPosition,
              close,
              listboxId,
              activeOptionId,
            }) => (
              <FavoriteSkillsPanel
                favorites={favoriteSkillItems}
                searchQuery={query}
                listboxId={listboxId}
                activeOptionId={activeOptionId}
                onSelect={(item) => {
                  close({ consumeQuery: true });
                  insertAndPush(item.id, item.name, caretPosition);
                }}
                onToggleFavorite={onToggleFavorite}
                onBrowse={() => {
                  const text = `${SKILL_TRIGGER_PREFIX}${query}`;
                  const matchedAnchor = mentions.anchors.find(
                    (anchor) =>
                      anchor.start === caretPosition &&
                      anchor.length === text.length,
                  );
                  close({ consumeQuery: true, returnFocus: false });
                  setBrowseCaretPosition(caretPosition);
                  browseRestoreTextRef.current = {
                    position: caretPosition,
                    text,
                    mentionUrl: matchedAnchor?.url,
                  };
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
      isSkillsSupported,
      addMenuLabel,
      emptyQueryHintLabel,
      favoriteSkillItems,
      insertAndPush,
      mentions.anchors,
      onToggleFavorite,
      panelLabels,
    ],
  );

  /* Restore a canceled browse once; a completed selection clears the snapshot. */
  const handleCatalogClose = useCallback(() => {
    setIsCatalogOpen(false);
    const browseRestoreText = browseRestoreTextRef.current;
    browseRestoreTextRef.current = null;
    if (browseRestoreText == null) return;

    const { position, text, mentionUrl } = browseRestoreText;
    if (mentionUrl != null) {
      mentions.restoreMention(mentionUrl, text.slice(1), position);
    } else {
      mentions.onDraftChange(
        mentions.draft.slice(0, position) +
          text +
          mentions.draft.slice(position),
      );
    }
    setMessageRevision((revision) => revision + 1);
    setCaretPositionOverride(position + text.length);
  }, [mentions]);

  const skillCatalogModal = (
    <SkillCatalogModal
      isOpen={isCatalogOpen}
      onClose={handleCatalogClose}
      onSelect={(id) => {
        browseRestoreTextRef.current = null;
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
