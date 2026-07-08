import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  DeploymentsI18nKeys,
} from '../../constants/translation-keys';

interface Params {
  isLoading: boolean;
  error: unknown;
  itemCount: number;
}

interface Result {
  ariaLabel: string;
  loading: string | undefined;
  error: string | undefined;
  empty: string | undefined;
  searchPlaceholder: string;
  closeLabel: string;
}

export const useModelSelectorLabels = ({
  isLoading,
  error,
  itemCount,
}: Params): Result => {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      ariaLabel: t(DeploymentsI18nKeys.SelectorAriaLabel),
      loading: isLoading ? t(DeploymentsI18nKeys.SelectorLoading) : undefined,
      error: error ? t(DeploymentsI18nKeys.SelectorError) : undefined,
      empty:
        !isLoading && !error && itemCount === 0
          ? t(DeploymentsI18nKeys.SelectorEmpty)
          : undefined,
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
      closeLabel: t(DeploymentsI18nKeys.SelectorCloseLabel),
    }),
    [t, isLoading, error, itemCount],
  );
};
