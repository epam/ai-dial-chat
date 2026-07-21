import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useDeployments } from '../../context/DeploymentsContext';
import useFavoriteApplications from '../../hooks/useFavoriteApplications/useFavoriteApplications';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

const DeploymentSelectorOverlay = lazy(
  () => import('./DeploymentSelectorOverlay'),
);

const CatalogModal = lazy(async () => {
  const module = await import('./CatalogModal');
  return { default: module.default };
});

interface UseDeploymentSelectorOverlayResult {
  /** Pass directly as the `modelPickerOverlay` prop of `ConversationInput`. */
  renderOverlay: (onClose: () => void) => ReactNode;
  /** Render this element at a stable level outside the popover (e.g. next to the input). */
  catalogModal: ReactNode;
}

export function useDeploymentSelectorOverlay(): UseDeploymentSelectorOverlayResult {
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

  const renderOverlay = useCallback(
    (onClose: () => void): ReactNode => (
      <Suspense fallback={null}>
        <DeploymentSelectorOverlay
          favorites={favoriteCatalogItems}
          selectedId={selectedItemId}
          selectedItem={selectedCatalogItem}
          onSelect={setSelectedItemId}
          onToggleFavorite={toggleFavorite}
          onClose={onClose}
          onBrowseCatalog={() => setIsCatalogOpen(true)}
        />
      </Suspense>
    ),
    [
      favoriteCatalogItems,
      selectedItemId,
      selectedCatalogItem,
      setSelectedItemId,
      toggleFavorite,
    ],
  );

  const catalogModal = (
    <Suspense fallback={null}>
      <CatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
      />
    </Suspense>
  );

  return { renderOverlay, catalogModal };
}
