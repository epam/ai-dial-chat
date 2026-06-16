import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import {
  ChatI18nKeys,
  MarketplaceI18nKeys,
  SideBarI18nKeys,
} from '@/src/constants/i18n';

type TranslateFn = (key: string, options?: { ns?: Translation }) => string;

function tryFallback(
  t: TranslateFn,
  candidates: Array<{ key: string; ns?: Translation }>,
): string | null {
  for (const { key, ns } of candidates) {
    const translated = ns ? t(key, { ns }) : t(key);
    if (translated !== key) {
      return translated;
    }
  }

  return null;
}

export function translateEntityTypeFilterLabel(
  value: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (value === EntityType.Application) {
    const primary = t(SideBarI18nKeys.Applications);
    if (locale !== 'en' && primary === SideBarI18nKeys.Applications) {
      return (
        tryFallback(t, [
          { key: SideBarI18nKeys.Apps },
          {
            key: MarketplaceI18nKeys.Applications,
            ns: Translation.Marketplace,
          },
        ]) ?? primary
      );
    }

    return primary;
  }

  if (value === EntityType.Model) {
    const primary = t(SideBarI18nKeys.Models);
    if (locale !== 'en' && primary === SideBarI18nKeys.Models) {
      return (
        tryFallback(t, [
          { key: MarketplaceI18nKeys.Models, ns: Translation.Marketplace },
          { key: ChatI18nKeys.Model, ns: Translation.Chat },
          {
            key: MarketplaceI18nKeys.ModelMarketplace,
            ns: Translation.Marketplace,
          },
        ]) ?? primary
      );
    }

    return primary;
  }

  return value;
}
