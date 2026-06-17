import { getFilterLabel } from '@/src/utils/app/rules';

import { PublicationFunctions } from '@/src/types/publication';
import { TranslationOptions } from '@/src/types/translation';

import { SideBarI18nKeys } from '@/src/constants/i18n';

import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

type TranslateFn = (key: string, options?: TranslationOptions) => string;

const normalizePublicationSource = (source: string) =>
  source.trim().toLowerCase().replace(/_/g, ' ');

const PUBLICATION_SOURCE_I18N_KEYS: Record<string, SideBarI18nKeys> = {
  title: SideBarI18nKeys.PublicationFilterTitle,
  'job title': SideBarI18nKeys.PublicationFilterJobTitle,
  role: SideBarI18nKeys.PublicationFilterRole,
  'dial roles': SideBarI18nKeys.PublicationFilterDialRoles,
};

const PUBLICATION_FUNCTION_I18N_KEYS: Record<string, SideBarI18nKeys> = {
  [PublicationFunctions.Contain]: SideBarI18nKeys.Contains,
  [PublicationFunctions.Equal]: SideBarI18nKeys.Equals,
  [PublicationFunctions.Regex]: SideBarI18nKeys.Regex,
};

export const PUBLICATION_FILTER_I18N_KEYS = [
  ...Object.values(PUBLICATION_SOURCE_I18N_KEYS),
  ...Object.values(PUBLICATION_FUNCTION_I18N_KEYS),
];

export function translatePublicationFilterSourceLabel(
  source: string,
  t: TranslateFn,
): string {
  const normalized = normalizePublicationSource(source);
  const i18nKey = PUBLICATION_SOURCE_I18N_KEYS[normalized];
  const fallback = startCase(toLower(source.replace(/_/g, ' ')));

  if (!i18nKey) {
    return fallback;
  }

  const translated = t(i18nKey);

  return translated !== i18nKey ? translated : fallback;
}

export function translatePublicationFunctionLabel(
  filterType: string,
  t: TranslateFn,
): string {
  const i18nKey = PUBLICATION_FUNCTION_I18N_KEYS[filterType];
  const fallback = getFilterLabel(filterType);

  if (!i18nKey) {
    return fallback;
  }

  const translated = t(i18nKey);

  return translated !== i18nKey ? translated : fallback;
}
