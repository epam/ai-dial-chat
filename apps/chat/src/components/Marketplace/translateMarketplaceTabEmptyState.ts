import { Translation } from '@/src/types/translation';

import { CommonI18nKeys, MarketplaceI18nKeys } from '@/src/constants/i18n';

type TranslateFn = (key: string, options?: { ns?: Translation }) => string;

function isFallback(key: string, translated: string) {
  return translated === key;
}

export function translateMarketplaceTabEmptyState(
  key: string,
  _locale: string | undefined,
  t: TranslateFn,
): string {
  const primary = t(key);
  if (!isFallback(key, primary)) {
    return primary;
  }

  if (key === MarketplaceI18nKeys.NoToolsets) {
    const entity = t(MarketplaceI18nKeys.Toolsets);
    if (!isFallback(MarketplaceI18nKeys.Toolsets, entity)) {
      return `No ${entity.toLowerCase()}`;
    }
  }

  if (key === MarketplaceI18nKeys.YouDontHaveAnyToolsets) {
    const entity = t(MarketplaceI18nKeys.Toolsets);
    if (!isFallback(MarketplaceI18nKeys.Toolsets, entity)) {
      return `You don't have any ${entity.toLowerCase()}.`;
    }
  }

  if (key === MarketplaceI18nKeys.NoAgents) {
    const entity = t(MarketplaceI18nKeys.Agents);
    if (!isFallback(MarketplaceI18nKeys.Agents, entity)) {
      return `No ${entity.toLowerCase()}`;
    }
  }

  if (key === MarketplaceI18nKeys.YouDontHaveAnyAgents) {
    const entity = t(MarketplaceI18nKeys.Agents);
    if (!isFallback(MarketplaceI18nKeys.Agents, entity)) {
      return `You don't have any ${entity.toLowerCase()}.`;
    }
  }

  if (key === MarketplaceI18nKeys.NoSearchResults) {
    const translated = t(CommonI18nKeys.NoResultsFound, {
      ns: Translation.Common,
    });
    if (!isFallback(CommonI18nKeys.NoResultsFound, translated)) {
      return translated;
    }
  }

  return primary;
}
