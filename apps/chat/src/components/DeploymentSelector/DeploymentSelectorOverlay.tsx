import { lazy, memo, Suspense, useMemo, useState, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  DeploymentSelectorI18nKeys,
  FavoritesI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import useFavoriteApplications from '../../hooks/useFavoriteApplications/useFavoriteApplications';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';
import type { DeploymentSelectorLabels } from './DeploymentSelectorPanel';

const DeploymentSelectorPanel = lazy(() => import('./DeploymentSelectorPanel'));

const CatalogModal = lazy(async () => {
  const module = await import('./CatalogModal');
  return { default: module.default };
});

interface Props {
  onClose: () => void;
}

const DeploymentSelectorOverlay: FC<Props> = ({ onClose }) => {
  const { t } = useTranslation();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const { items, selectedItemId, setSelectedItemId } = useDeployments();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();

  const favoriteCatalogItems = useMemo(
    () =>
      items
        .filter((d) => favoriteIds.has(d.id))
        .map((d) => mapDeploymentToCatalogItem(d, favoriteIds)),
    [items, favoriteIds],
  );

  const selectedDeployment = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  const selectedCatalogItem = useMemo(
    () =>
      selectedDeployment
        ? mapDeploymentToCatalogItem(selectedDeployment, favoriteIds)
        : undefined,
    [selectedDeployment, favoriteIds],
  );

  const labels: DeploymentSelectorLabels = {
    searchPlaceholder: t(DeploymentSelectorI18nKeys.SearchPlaceholder),
    favoritesLabel: t(FavoritesI18nKeys.FavoritesLabel),
    emptyHint: t(DeploymentSelectorI18nKeys.EmptyHint),
    browseCatalogLabel: t(ButtonsI18nKeys.Browse),
    removeFromFavoritesLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
    currentlySelectedLabel: t(
      DeploymentSelectorI18nKeys.CurrentlySelectedLabel,
    ),
    addToFavoritesLabel: t(FavoritesI18nKeys.AddToFavorites),
  };

  return (
    <>
      <Suspense fallback={null}>
        <DeploymentSelectorPanel
          favorites={favoriteCatalogItems}
          selectedId={selectedItemId}
          selectedItem={selectedCatalogItem}
          onSelect={setSelectedItemId}
          onToggleFavorite={toggleFavorite}
          onBrowseCatalog={() => setIsCatalogOpen(true)}
          onClose={onClose}
          labels={labels}
        />
      </Suspense>
      <Suspense fallback={null}>
        <CatalogModal
          isOpen={isCatalogOpen}
          onClose={() => setIsCatalogOpen(false)}
        />
      </Suspense>
    </>
  );
};

export default memo(DeploymentSelectorOverlay);
