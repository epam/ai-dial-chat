import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useDeployments } from '../../context/DeploymentsContext';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { findDeploymentByIdOrReference } from '../../utils/deployment-id';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

const DeploymentSelectorOverlay = lazy(
  () => import('./DeploymentSelectorOverlay'),
);

const CatalogModal = lazy(async () => {
  const module = await import('./CatalogModal');
  return { default: module.default };
});

interface UseDeploymentSelectorFieldOverlayResult {
  /** Render at the position where the dropdown overlay content should appear. */
  renderOverlay: (onClose: () => void) => ReactNode;
  /** Render this element at a stable level outside the popover (e.g. next to the trigger). */
  catalogModal: ReactNode;
  /** True while the deployment list is being fetched. */
  isLoading: boolean;
  /** Non-null if the deployments fetch failed. */
  error: Error | null;
  /**
   * Display label for `selectedId`: the resolved deployment's name, or the
   * raw `selectedId` itself when it can't be resolved against the loaded
   * deployment list (e.g. a deleted/renamed deployment referenced by an
   * existing Scheduled Task) — never silently blank.
   */
  resolvedLabel: string | null;
}

/**
 * Selection-agnostic variant of `useDeploymentSelectorOverlay`: binds the
 * same deployment-selector overlay content to a caller-owned `selectedId`/
 * `onSelect` pair instead of `DeploymentsContext`'s own `selectedItemId`/
 * `setSelectedItemId`, so a host form's draft selection never reads or
 * writes the chat input's active deployment.
 */
export function useDeploymentSelectorFieldOverlay(
  selectedId: string | null,
  onSelect: (id: string) => void,
): UseDeploymentSelectorFieldOverlayResult {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

  const { t } = useTranslation();
  const { items, isLoading, error } = useDeployments();
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();
  const { language } = useLanguage();

  const favoriteCatalogItems = useMemo(
    () =>
      items
        .filter((d) => favoriteIds.has(d.id))
        .map((d) =>
          mapDeploymentToCatalogItem(d, {
            favoriteIds,
            t,
            activeLocale: language,
          }),
        ),
    [items, favoriteIds, t, language],
  );

  const selectedDeployment = useMemo(
    () => findDeploymentByIdOrReference(items, selectedId),
    [items, selectedId],
  );

  const selectedCatalogItem = useMemo(
    () =>
      selectedDeployment
        ? mapDeploymentToCatalogItem(selectedDeployment, {
            favoriteIds,
            t,
            activeLocale: language,
          })
        : undefined,
    [selectedDeployment, favoriteIds, t, language],
  );

  const resolvedLabel = useMemo(() => {
    if (selectedId == null) return null;
    return selectedCatalogItem?.name ?? selectedId;
  }, [selectedId, selectedCatalogItem]);

  const renderOverlay = useCallback(
    (onClose: () => void): ReactNode => (
      <Suspense fallback={null}>
        <DeploymentSelectorOverlay
          favorites={favoriteCatalogItems}
          selectedId={selectedId}
          selectedItem={selectedCatalogItem}
          onSelect={onSelect}
          onToggleFavorite={toggleFavorite}
          onClose={onClose}
          onBrowseCatalog={() => setIsCatalogOpen(true)}
        />
      </Suspense>
    ),
    [
      favoriteCatalogItems,
      selectedId,
      selectedCatalogItem,
      onSelect,
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

  return { renderOverlay, catalogModal, isLoading, error, resolvedLabel };
}
