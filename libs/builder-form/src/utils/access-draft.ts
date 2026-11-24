import { AccessLevel } from '@epam/ai-dial-chat-shared';
import type { AccessContentOption, AccessEntry } from '../models/access';

/** One card of the modal draft; either field may still be empty. */
export interface AccessDraftCard {
  /** Stable key of the card. */
  id: string;
  /** Chosen content option id, or `''` while none is chosen. */
  contentId: string;
  /** Chosen level, or `''` while none is chosen. */
  level: AccessLevel | '';
}

let draftCardCounter = 0;

const createDraftCard = (
  contentId = '',
  level: AccessLevel | '' = '',
): AccessDraftCard => ({
  id: `access-card-${++draftCardCounter}`,
  contentId,
  level,
});

/**
 * Tells whether a card has both fields filled.
 * @param card - the card to check
 */
const isDraftCardComplete = (card: AccessDraftCard): boolean =>
  card.contentId !== '' && card.level !== '';

/**
 * Tells whether a card has neither field filled.
 * @param card - the card to check
 */
export const isDraftCardEmpty = (card: AccessDraftCard): boolean =>
  card.contentId === '' && card.level === '';

/**
 * Appends an empty card when the last card is complete or there is none, so
 * exactly one card is left to fill in.
 * @param cards - the draft cards
 */
export const withTrailingCard = (
  cards: AccessDraftCard[],
): AccessDraftCard[] => {
  const last = cards[cards.length - 1];
  if (last != null && !isDraftCardComplete(last)) return cards;
  return [...cards, createDraftCard()];
};

/**
 * Builds the draft a modal starts from: one card per entry plus a trailing empty card.
 * @param value - the entries the modal opens with
 */
export const buildAccessDraft = (value: AccessEntry[]): AccessDraftCard[] =>
  withTrailingCard(
    value.map((entry) => createDraftCard(entry.contentId, entry.level)),
  );

/**
 * Returns the level when the option allows it, otherwise `Read`; an unset level stays unset.
 * @param option - the option the card now holds
 * @param level - the level the card held
 */
export const resetLevelForOption = (
  option: AccessContentOption | undefined,
  level: AccessLevel | '',
): AccessLevel | '' => {
  if (level === '' || option == null) return level;
  return option.allowedAccess.includes(level) ? level : AccessLevel.Read;
};

/**
 * Keeps only the complete cards, in order, as entries.
 * @param cards - the draft cards
 */
export const toAccessEntries = (cards: AccessDraftCard[]): AccessEntry[] =>
  cards.flatMap((card) =>
    card.level === '' || card.contentId === ''
      ? []
      : [{ contentId: card.contentId, level: card.level }],
  );
