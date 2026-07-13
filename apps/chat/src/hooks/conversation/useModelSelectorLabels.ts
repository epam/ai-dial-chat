import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  DeploymentSelectorI18nKeys,
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
      ariaLabel: t(DeploymentSelectorI18nKeys.AriaLabel),
      loading: isLoading ? t(DeploymentSelectorI18nKeys.Loading) : undefined,
      error: error ? t(DeploymentSelectorI18nKeys.Error) : undefined,
      empty:
        !isLoading && !error && itemCount === 0
          ? t(DeploymentSelectorI18nKeys.Empty)
          : undefined,
      searchPlaceholder: t(BasicI18nKeys.SearchPlaceholder),
      closeLabel: t(DeploymentSelectorI18nKeys.CloseLabel),
    }),
    [t, isLoading, error, itemCount],
  );
};
