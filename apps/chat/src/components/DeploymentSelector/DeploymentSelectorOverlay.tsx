import type { CatalogItem } from '@epam/ai-dial-catalog';
import { lazy, memo, Suspense, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  DeploymentSelectorI18nKeys,
  FavoritesI18nKeys,
} from '../../constants/translation-keys';
import type { DeploymentSelectorLabels } from './DeploymentSelectorPanel';

const DeploymentSelectorPanel = lazy(() => import('./DeploymentSelectorPanel'));

interface Props {
  favorites: CatalogItem[];
  selectedId?: string | null;
  selectedItem?: CatalogItem;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => Promise<void> | void;
  onClose: () => void;
  onBrowseCatalog?: () => void;
}

const DeploymentSelectorOverlay: FC<Props> = ({
  favorites,
  selectedId,
  selectedItem,
  onSelect,
  onToggleFavorite,
  onClose,
  onBrowseCatalog,
}) => {
  const { t } = useTranslation();

  const labels: DeploymentSelectorLabels = {
    searchPlaceholder: t(DeploymentSelectorI18nKeys.SearchPlaceholder),
    clearSearchLabel: t(BasicI18nKeys.ClearSearch),
    favoritesLabel: t(FavoritesI18nKeys.FavoritesLabel),
    emptyHint: t(DeploymentSelectorI18nKeys.EmptyHint),
    browseCatalogLabel: t(DeploymentSelectorI18nKeys.BrowseCatalogLabel),
    removeFromFavoritesLabel: t(FavoritesI18nKeys.RemoveFromFavorites),
    currentlySelectedLabel: t(
      DeploymentSelectorI18nKeys.CurrentlySelectedLabel,
    ),
    addToFavoritesLabel: t(FavoritesI18nKeys.AddToFavorites),
  };

  return (
    <Suspense fallback={null}>
      <DeploymentSelectorPanel
        favorites={favorites}
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={onSelect}
        onToggleFavorite={onToggleFavorite}
        onBrowseCatalog={onBrowseCatalog}
        onClose={onClose}
        labels={labels}
      />
    </Suspense>
  );
};

export default memo(DeploymentSelectorOverlay);
