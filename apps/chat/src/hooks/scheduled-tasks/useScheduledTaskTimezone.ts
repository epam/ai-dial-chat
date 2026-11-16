import {
  findTimezoneOption,
  getTimezoneOptions,
} from '@epam/ai-dial-chat-hooks/scheduled-tasks';
import { getBrowserTimezone } from '@epam/ai-dial-chat-hooks/utils';
import type { ScheduledTaskCreateFormTimezone } from '@epam/ai-dial-scheduled-tasks';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys as BasicKeys,
  ScheduledTasksI18nKeys as Keys,
} from '../../constants/translation-keys';
import { useLanguage } from '../language/useLanguage';

/** Zone a new task starts in when the browser reports none the platform lists. */
const FALLBACK_TIMEZONE = 'UTC';

/**
 * Supplies the create/edit pages with the time zone picker's data: the sorted
 * zone list (built once per display language, since it is a few hundred `Intl`
 * lookups), the viewer's own zone, and the translated picker wording. Kept in
 * one hook so both pages open the same picker and the lib never touches `t()`.
 */
export const useScheduledTaskTimezone = () => {
  const { t } = useTranslation();
  const { displayLanguage } = useLanguage();

  const options = useMemo(
    () => getTimezoneOptions({ locale: displayLanguage }),
    [displayLanguage],
  );

  const browserTimezone = useMemo(() => {
    const reported = getBrowserTimezone();
    return (
      findTimezoneOption(options, reported)?.id ?? reported ?? FALLBACK_TIMEZONE
    );
  }, [options]);

  const timezone = useMemo<ScheduledTaskCreateFormTimezone>(
    () => ({
      options,
      browserTimezoneId: browserTimezone,
      labels: {
        changeLabel: t(Keys.CreateTimezoneChangeLabel),
        dialogAriaLabel: t(Keys.CreateTimezoneDialogAriaLabel),
        searchPlaceholder: t(Keys.CreateTimezoneSearchPlaceholder),
        searchAriaLabel: t(Keys.CreateTimezoneSearchAriaLabel),
        clearSearchAriaLabel: t(BasicKeys.ClearSearch),
        yourZoneHeading: t(Keys.CreateTimezoneYourZone),
        allZonesHeading: t(Keys.CreateTimezoneAllZones),
        listAriaLabel: t(Keys.CreateTimezoneListAriaLabel),
        noResultsTitle: t(Keys.CreateTimezoneNoResults),
        noResultsDescription: t(Keys.CreateTimezoneNoResultsDescription),
        resultsCountLabel: (count) =>
          t(Keys.CreateTimezoneResultsCount, { count }),
        gapHintLabel: (time) => t(Keys.CreateTimezoneGapHint, { time }),
      },
    }),
    [options, browserTimezone, t],
  );

  return { browserTimezone, timezone };
};
