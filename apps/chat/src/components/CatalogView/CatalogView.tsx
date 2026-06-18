import type { FavoriteItem } from '@epam/ai-dial-catalog';
import { Catalog } from '@epam/ai-dial-catalog';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

// TODO: add favorites functionality and replace with actual favorites from backend
const EMPTY_FAVORITES: FavoriteItem[] = [];

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const { items: deployments } = useDeployments();

  const catalogItems = useMemo(
    () => deployments.map(mapDeploymentToCatalogItem),
    [deployments],
  );

  return (
    <Catalog
      items={catalogItems}
      favorites={EMPTY_FAVORITES}
      texts={{
        pageTitle: t(CatalogI18nKeys.PageTitle),
        createLabel: t(ButtonsI18nKeys.Create),
        favoritesTitle: t(CatalogI18nKeys.FavoritesTitle),
        browseTitle: t(ButtonsI18nKeys.Browse),
        searchPlaceholder: t(CatalogI18nKeys.SearchPlaceholder),
        noResultsDescription: t(CatalogI18nKeys.NoResultsDescription),
        ariaLabel: t(CatalogI18nKeys.AriaLabel),
      }}
    />
  );
};

export default memo(CatalogView);
