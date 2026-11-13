import type { VersionHistoryFormatters } from '@epam/ai-dial-chat-hooks';
import type { VersionHistoryLabels } from '@epam/ai-dial-publish-panel';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
  VersionHistoryI18nKeys,
} from '../../constants/translation-keys';
import { useLanguage } from '../language/useLanguage';

/** Translated labels and formatters of the Versions history section, shared by every panel that shows it. */
export const useVersionHistoryText = (): {
  labels: VersionHistoryLabels;
  formatters: VersionHistoryFormatters;
} => {
  const { t } = useTranslation();
  const { displayLanguage } = useLanguage();

  const labels = useMemo<VersionHistoryLabels>(
    () => ({
      heading: t(VersionHistoryI18nKeys.Heading),
      currentLabel: t(VersionHistoryI18nKeys.Current),
      notPublishedLabel: t(VersionHistoryI18nKeys.NotPublished),
      inReviewLabel: t(VersionHistoryI18nKeys.InReview),
      publishedLabel: t(VersionHistoryI18nKeys.Published),
      publishedInLabel: t(VersionHistoryI18nKeys.PublishedIn, {
        folders: '{folders}',
        interpolation: { escapeValue: false },
      }),
      unknownLabel: t(VersionHistoryI18nKeys.StatusUnavailable),
      loadingLabel: t(VersionHistoryI18nKeys.Loading),
      emptyLabel: t(VersionHistoryI18nKeys.Empty),
      errorLabel: t(VersionHistoryI18nKeys.LoadFailed),
      retryLabel: t(ButtonsI18nKeys.Retry),
    }),
    [t],
  );

  const formatters = useMemo<VersionHistoryFormatters>(
    () => ({
      rootLabel: t(CatalogI18nKeys.FolderPersonal),
      formatDate: (timestamp) =>
        new Date(timestamp).toLocaleDateString(
          /* English uses the day-month-year order of the mockups, e.g. "12 Jul 2026". */
          displayLanguage.startsWith('en') ? 'en-GB' : displayLanguage,
          { day: '2-digit', month: 'short', year: 'numeric' },
        ),
      formatPublishedBy: (name) =>
        t(VersionHistoryI18nKeys.PublishedBy, {
          name,
          interpolation: { escapeValue: false },
        }),
      formatOwner: (name) =>
        t(VersionHistoryI18nKeys.Owner, {
          name,
          interpolation: { escapeValue: false },
        }),
    }),
    [t, displayLanguage],
  );

  return { labels, formatters };
};
