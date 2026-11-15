import {
  getCitationGroupPage,
  type AnnotationGroup,
  type CitationMarkerLabels,
} from '@epam/ai-dial-quotations';
import type { TFunction } from 'i18next';
import { CitationsI18nKeys } from '../../../constants/translation-keys';

/** Builds a citation marker's translated labels, naming the cited page when `getCitationGroupPage` resolves one. */
export const buildCitationMarkerLabels = (
  t: TFunction,
  group: AnnotationGroup,
): CitationMarkerLabels => {
  const source = group.sourceName;
  const count = group.annotations.length - 1;
  const page = getCitationGroupPage(group);

  if (page == null) {
    return {
      ariaLabel: t(CitationsI18nKeys.MarkerAriaLabel, { source }),
      label: t(CitationsI18nKeys.MarkerLabel, { source }),
      labelWithOverflow: t(CitationsI18nKeys.MarkerLabelWithOverflow, {
        source,
        count,
      }),
    };
  }

  return {
    ariaLabel: t(CitationsI18nKeys.MarkerAriaLabelWithPage, { source, page }),
    label: t(CitationsI18nKeys.MarkerLabelWithPage, { source, page }),
    labelWithOverflow: t(CitationsI18nKeys.MarkerLabelWithPageAndOverflow, {
      source,
      page,
      count,
    }),
  };
};
