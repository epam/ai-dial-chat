import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import type {
  CommandMenuConfig,
  HighlightedTextRange,
  MenuOverlayConfig,
} from '@epam/ai-dial-conversation-input';
import type { ComponentType, ReactNode } from 'react';
import type { ChatSkillDetailsTrigger } from './chat-skill-props';
import type { SkillListingEntry } from './favorite-skill-item';
import type { FavoriteSkillsPanelLabels } from './favorite-skills-panel-props';

/**
 * Props accepted by the details-panel component injected into
 * `useSkillSelectorOverlay`. The rendered panel is the host's composition;
 * the flow this hook opens it from ("View details") is information-only, so
 * hosts typically render it read-only.
 */
export interface SkillDetailsPanelComponentProps {
  /** Resource URL of the skill whose details are shown; `null` renders nothing. */
  skillId: string | null;
  /** Called when the panel should close (close button or backdrop click). */
  onClose: () => void;
}

/** Localizable string labels for the skill selector overlay flow. */
export interface SkillSelectorOverlayLabels {
  /** Add-menu entry label and mobile sheet title. Defaults to `'Skills'`. */
  addMenuLabel?: string;
  /** Accessible label for the mobile sheet's back arrow. Defaults to `'Back'`. */
  backLabel?: string;
  /** Header title of the "Use skill" browse modal. Defaults to `'Use skill'`. */
  catalogModalTitleLabel?: string;
  /**
   * Hint rendered in the text area right after the `/` while the slash menu
   * is open with an empty query. Defaults to `'Type to filter'`.
   */
  emptyQueryHintLabel?: string;
  /** Labels forwarded to the favorites panel rendered as the overlay. */
  panelLabels?: FavoriteSkillsPanelLabels;
}

/** Options accepted by `useSkillSelectorOverlay`. */
export interface UseSkillSelectorOverlayOptions {
  /**
   * Whether the skill flow is enabled. While `false` the hook returns empty
   * outputs: no menu entry, no modal, no panel, no chips.
   */
  isEnabled: boolean;
  /**
   * Whether the input's current deployment supports skills. While `false`
   * (with the flow enabled) the entry points are omitted — no Add-menu item
   * and no slash menu — but a tracked mention stays in the draft text and
   * folds into `isSkillUnsupported` for the host's own send-disabled
   * condition. The host resolves this from its own deployment data. Note: a
   * live-composing mention has no per-mention error styling of its own (it
   * renders as a plain highlighted run, not a `ChatSkill`); only the sent
   * `custom_content.skills`/history rendering, and this boolean fold, reflect
   * the unsupported state.
   */
  isSkillsSupported: boolean;
  /** The user's own skills. */
  skills: SkillListingEntry[];
  /** Skills shared with the user, when the host distinguishes them. */
  sharedWithMe?: SkillListingEntry[];
  /** Public skills, when the host distinguishes them. */
  publicSkills?: SkillListingEntry[];
  /** Ids (`skills/{bucket}/{path}` URLs) of the user's favorited skills. */
  favoriteIds: ReadonlySet<string>;
  /** Removes a skill from favorites; fired by a row's star button. */
  onToggleFavorite: (id: string) => void;
  /** Localizable string overrides. */
  labels?: SkillSelectorOverlayLabels;
  /**
   * Typography class applied to each history `ChatSkill` chip's label.
   * History chips render beside the message bubble's first text line — inline
   * within it (user bubble) or overlaid on it (assistant bubble) — so pass
   * the class the bubbles' body text uses, keeping the chip's height matched
   * to that line. Unset falls back to the chip's own default label class.
   */
  historyChipLabelClassName?: string;
  /**
   * Trigger used by mentions rendered in an active composer. Unset retains
   * `ChatSkill`'s hover-and-focus default; history chips are unaffected.
   */
  activeMentionDetailsTrigger?: ChatSkillDetailsTrigger;
  /**
   * Renders the browse modal's picker content (e.g. a host catalog view);
   * receives the selection and close callbacks to wire into it, and is
   * mounted only while the modal is open.
   */
  renderCatalogContent: (
    onSelect: (id: string) => void,
    onClose: () => void,
  ) => ReactNode;
  /** The skill details side panel; may be a lazily loaded component. */
  detailsPanelComponent: ComponentType<SkillDetailsPanelComponentProps>;
}

/** Returned by `useSkillSelectorOverlay`. */
export interface UseSkillSelectorOverlayResult {
  /**
   * The Skills entry for the `menuOverlays` prop of
   * `ConversationInput`/`EditMessageInput`/`Input`. `undefined` while the flow
   * is disabled or the current deployment does not support skills: the host
   * omits the entry entirely when this is `undefined`, so a stub renderer
   * would leave the menu item in place with nothing behind it.
   */
  skillMenuOverlay?: MenuOverlayConfig;
  /**
   * The Skills entry for the `commandMenu` prop of
   * `ConversationInput`/`EditMessageInput`/`Input`: typing `/` into an empty
   * textarea opens the favorites panel in search mode above the input.
   * `undefined` while the flow is disabled or the current deployment does not
   * support skills, disabling the slash menu entirely.
   */
  commandMenu?: CommandMenuConfig;
  /**
   * The browse modal element. Render at a stable level outside the popover
   * (e.g. next to the input); `null` while `isEnabled` is `false`.
   */
  skillCatalogModal: ReactNode;
  /**
   * The skill details side panel opened by a row tooltip's "View details".
   * `null` while `isEnabled` is `false`.
   */
  skillDetailsPanel: ReactNode;
  /**
   * The composer's message text after the most recent skill selection, with
   * every `/{name}` mention spliced in. Pass straight through to
   * `ConversationInput`/`EditMessageInput`'s own `message` prop alongside
   * `messageRevision` — like that prop's existing "populated by a starter
   * selection" use, this is a one-shot push applied on a `messageRevision`
   * bump, not a value the host feeds back on every keystroke (ordinary typing
   * is tracked separately through `onDraftChange`).
   */
  message: string;
  /**
   * Token that forces `message` to re-apply even when its string value is
   * unchanged from the last push (e.g. the same skill selected again).
   * Bumped on every call to the selection handlers backing `skillMenuOverlay`
   * and `commandMenu`. Pass straight through to the composer's own
   * `messageRevision` prop.
   */
  messageRevision: number;
  /**
   * Every currently-tracked skill mention's character range within the
   * composer's live draft text, for `ConversationInput`/`EditMessageInput`/
   * `Input`'s `activeMentions` prop (the live-composing highlighted-run
   * render). Empty while nothing is mentioned or the flow is disabled.
   */
  activeMentions: HighlightedTextRange[];
  /**
   * Reconciles tracked mentions against an external edit to the composer's
   * draft text (ordinary typing, deleting, pasting, undo/redo). Wire to the
   * composer's own `onChange` callback, in addition to whatever the host
   * already does with that value — this keeps `activeMentions`/
   * `selectedSkills` in sync with live edits between selections.
   */
  onDraftChange: (nextValue: string) => void;
  /**
   * Looks up the mention whose run ends exactly at `caretPosition`, without
   * mutating any state. Pass straight through to the composer's
   * `onBackspaceAtCaret` prop, which performs the actual whole-mention
   * deletion through the textarea's native editing pipeline and reports the
   * result back through `onDraftChange`. Returns `undefined` when the caret
   * isn't at a mention boundary.
   */
  onBackspaceAtCaret: (
    caretPosition: number,
  ) => HighlightedTextRange | undefined;
  /**
   * Caret offset to place the cursor at immediately after the most recent
   * skill selection applies `message`/`messageRevision` — the position right
   * after the inserted mention's text. Pass straight through to the
   * composer's `caretPositionOverride` prop. `undefined` before any selection
   * has been made this session.
   */
  caretPositionOverride: number | undefined;
  /**
   * Whether at least one skill is mentioned while the current deployment does
   * not support skills — hosts must fold this into their send-disabled
   * conditions. Always `false` while `isEnabled` is `false`.
   */
  isSkillUnsupported: boolean;
  /**
   * Every currently-tracked mention as the send-time `custom_content.skills`
   * payload, in left-to-right text order — `undefined` while nothing is
   * mentioned or the flow is disabled, so `custom_content.skills` is omitted
   * entirely. Cleared to `undefined` by `resetSkillMentions` after a
   * successful send.
   */
  selectedSkills: RequestSkill[] | undefined;
  /**
   * Clears every tracked mention and the draft text alongside it. Call after
   * a successful send, matching the per-message selection-clears semantics of
   * `custom_content.skills`.
   */
  resetSkillMentions: () => void;
  /**
   * Seeds the draft and its tracked mentions from a persisted message — runs
   * `matchSkillMentions` once against `content`/`skills` and initializes
   * `message`/`activeMentions` from the result (bumping `messageRevision`).
   * Call once when entering edit mode on a message that carries
   * `custom_content.skills`.
   */
  seedSkillMentions: (
    content: string,
    skills: RequestSkill[] | undefined,
  ) => void;
  /**
   * Renders a user message's `content` and `custom_content.skills` as an
   * ordered array interleaving plain-text runs and `ChatSkill` elements at
   * each mention's actual text position — for `UserMessageBubble`'s
   * `textSegments` prop. Resolves each entry's name from the listing pools
   * matched on its url, falling back to the url's last non-empty segment,
   * sharing the "View details" panel with the favorite rows. Returns `null`
   * while `isEnabled` is `false` or `skills` is empty/absent; a mention
   * `matchSkillMentions` cannot locate in `content` is simply omitted from
   * the render (see `matchSkillMentions`'s own doc for that heuristic).
   */
  renderHistorySkillSegments: (
    content: string,
    skills: RequestSkill[] | undefined,
  ) => ReactNode[] | null;
  /**
   * Renders every entry of `skills` as a flat list of `ChatSkill` elements,
   * ignoring text position — for `AssistantMessageBubble`'s `beforeContent`
   * slot, since assistant text is model-generated markdown and never
   * authors positioned mentions. Each entry's name/description resolve the
   * same way as `renderHistorySkillSegments`. Returns `null` while
   * `isEnabled` is `false` or the array is empty/absent.
   */
  renderHistorySkills: (skills: RequestSkill[] | undefined) => ReactNode;
}
