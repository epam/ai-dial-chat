import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { ShareLinkData } from '@epam/ai-dial-share';
import type { TFunction } from 'i18next';
import { ShareI18nKeys } from '../constants/translation-keys';

const HOURS_PER_DAY = 24;

/*
 * Agent-tab entities (Agent + Application, both shown under the "Agents"
 * catalog tab — see libs/catalog/src/utils/catalog-tabs.ts), Skill, Toolset,
 * and Prompt support edit access. Model can only ever be shared view-only, so
 * its access control is a static label, not a dropdown.
 */
const EDITABLE_ACCESS_TYPES = new Set<CatalogEntityType>([
  CatalogEntityType.Agent,
  CatalogEntityType.Prompt,
  CatalogEntityType.Skill,
  CatalogEntityType.Toolset,
]);

/** Whether a share link for a catalog entity of this type may grant edit access. */
export const canEditShareAccess = (type: CatalogEntityType): boolean =>
  EDITABLE_ACCESS_TYPES.has(type);

/**
 * Builds the share popover's expiry sentence from the link's remaining
 * lifetime. A TTL shorter than a day is described in hours, because whole
 * days round it up to "1 day"; anything longer stays in days. Returns
 * `undefined` when the expiry is unknown, so the popover renders no note.
 */
export const formatShareExpiryNote = (
  data: Pick<ShareLinkData, 'expiresInDays' | 'expiresInHours'> | undefined,
  t: TFunction,
): string | undefined => {
  const hours = data?.expiresInHours;
  if (hours != null && hours < HOURS_PER_DAY) {
    return t(ShareI18nKeys.ExpiryNoteHours, { count: hours });
  }

  const days = data?.expiresInDays;
  if (days == null) return undefined;
  return t(ShareI18nKeys.ExpiryNote, { count: days });
};
