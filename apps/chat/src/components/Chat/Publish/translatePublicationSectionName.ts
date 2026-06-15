import {
  PromptBarI18nKeys,
  SideBarI18nKeys,
} from '@/src/constants/i18n';

import { Translation } from '@/src/types/translation';

type TranslateFn = (
  key: string,
  options?: { ns?: Translation },
) => string;

const SECTION_NAMESPACE_FALLBACKS: Partial<Record<string, Translation>> = {
  [PromptBarI18nKeys.Conversations]: Translation.PromptBar,
  [PromptBarI18nKeys.Prompts]: Translation.PromptBar,
  [SideBarI18nKeys.Applications]: Translation.SideBar,
};

export function translatePublicationSectionName(
  key: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  const primary = t(key);
  if (!locale || locale === 'en' || primary !== key) {
    return primary;
  }

  const fallbackNamespace = SECTION_NAMESPACE_FALLBACKS[key];
  if (!fallbackNamespace) {
    return primary;
  }

  const fallback = t(key, { ns: fallbackNamespace });
  return fallback !== key ? fallback : primary;
}
