import type { ShareLinkData } from '@epam/ai-dial-share';
import type { TFunction } from 'i18next';
import { ShareI18nKeys } from '../constants/translation-keys';

const HOURS_PER_DAY = 24;

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
