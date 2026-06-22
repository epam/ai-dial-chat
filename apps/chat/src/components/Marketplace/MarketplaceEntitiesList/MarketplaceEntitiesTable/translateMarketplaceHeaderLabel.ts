import { Translation } from '@/src/types/translation';

import {
  CommonI18nKeys,
  MarketplaceI18nKeys,
  SideBarI18nKeys,
} from '@/src/constants/i18n';

type TranslateFn = (key: string, options?: { ns?: Translation }) => string;

export function translateMarketplaceHeaderLabel(
  label: string,
  _locale: string | undefined,
  t: TranslateFn,
): string {
  const primary = t(label);
  if (primary !== label) {
    return primary;
  }

  if (label === MarketplaceI18nKeys.Topics) {
    const translated = t(SideBarI18nKeys.Topics, { ns: Translation.SideBar });
    if (translated !== SideBarI18nKeys.Topics) {
      return translated;
    }
  }

  if (label === MarketplaceI18nKeys.Released) {
    const translated = t(MarketplaceI18nKeys.ReleaseDateMarketplace);
    if (translated !== MarketplaceI18nKeys.ReleaseDateMarketplace) {
      return translated;
    }
  }

  if (label === MarketplaceI18nKeys.Name) {
    const translated = t(CommonI18nKeys.Name, { ns: Translation.Common });
    if (translated !== CommonI18nKeys.Name) {
      return translated;
    }
  }

  if (label === MarketplaceI18nKeys.NameAndDescription) {
    const name = t(CommonI18nKeys.Name, { ns: Translation.Common });
    const description = t(CommonI18nKeys.Description, {
      ns: Translation.Common,
    });
    if (
      name !== CommonI18nKeys.Name &&
      description !== CommonI18nKeys.Description
    ) {
      return `${name} and ${description}`;
    }
  }

  return primary;
}
