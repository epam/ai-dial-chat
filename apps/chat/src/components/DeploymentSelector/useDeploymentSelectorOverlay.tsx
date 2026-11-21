import { findDeploymentByIdOrReference } from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { ModelSelectorPanelSkeleton } from '@epam/ai-dial-conversation-input';
import {
  lazy,
  Suspense,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { DeploymentSelectorI18nKeys } from '../../constants/translation-keys';
import { useAppConfig, useFeatureFlag } from '../../context/AppConfigContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { useUiFeature } from '../../hooks/useUiFeature';
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
  /** Clear the query on dismissal, retaining it across presentation changes. */
  onOpenChange: (open: boolean) => void;
  /** Render this element at a stable level outside the popover (e.g. next to the input). */
  catalogModal: ReactNode;
}

export function useDeploymentSelectorOverlay(): UseDeploymentSelectorOverlayResult {
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const onOpenChange = useCallback((open: boolean) => {
    if (!open) setSearchQuery('');
  }, []);

  const { t } = useTranslation();
  const { items, selectedItemId, setSelectedItemId } = useDeployments();
  const { config: appConfig } = useAppConfig();
  const { themesBaseUrl } = appConfig;
  const isDefaultDeploymentPinned = useFeatureFlag('defaultDeploymentPinned');
  const { favoriteIds, toggleFavorite } = useFavoriteApplications();
  const { language } = useLanguage();
  const isToolsetsEnabled = useUiFeature(OverlayFeature.Toolsets);

  const favoriteCatalogItems = useMemo(
    () =>
      items
        .filter((d) => favoriteIds.has(d.id))
        .map((d) =>
          mapDeploymentToCatalogItem(d, {
            favoriteIds,
            t,
            activeLocale: language,
            isToolsetTabEnabled: isToolsetsEnabled,
            themesBaseUrl,
          }),
        ),
    [items, favoriteIds, t, language, isToolsetsEnabled, themesBaseUrl],
  );

  const selectedDeployment = useMemo(
    () => findDeploymentByIdOrReference(items, selectedItemId),
    [items, selectedItemId],
  );

  const selectedCatalogItem = useMemo(
    () =>
      selectedDeployment
        ? mapDeploymentToCatalogItem(selectedDeployment, {
            favoriteIds,
            t,
            activeLocale: language,
            isToolsetTabEnabled: isToolsetsEnabled,
            themesBaseUrl,
          })
        : undefined,
    [
      selectedDeployment,
      favoriteIds,
      t,
      language,
      isToolsetsEnabled,
      themesBaseUrl,
    ],
  );

  const pinnedCatalogItem = useMemo(() => {
    if (!isDefaultDeploymentPinned) return undefined;
    const pinnedDeployment = findDeploymentByIdOrReference(
      items,
      appConfig.defaultDeploymentId,
    );
    return pinnedDeployment
      ? mapDeploymentToCatalogItem(pinnedDeployment, {
          favoriteIds,
          t,
          activeLocale: language,
          isToolsetTabEnabled: isToolsetsEnabled,
          themesBaseUrl,
        })
      : undefined;
  }, [
    isDefaultDeploymentPinned,
    items,
    appConfig.defaultDeploymentId,
    favoriteIds,
    t,
    language,
    isToolsetsEnabled,
    themesBaseUrl,
  ]);

  const renderOverlay = useCallback(
    (onClose: () => void): ReactNode => (
      <Suspense
        fallback={
          <ModelSelectorPanelSkeleton
            loadingLabel={t(DeploymentSelectorI18nKeys.Loading)}
          />
        }
      >
        <DeploymentSelectorOverlay
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          favorites={favoriteCatalogItems}
          pinnedItem={pinnedCatalogItem}
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
      searchQuery,
      favoriteCatalogItems,
      pinnedCatalogItem,
      selectedItemId,
      selectedCatalogItem,
      setSelectedItemId,
      toggleFavorite,
      t,
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

  return { onOpenChange, renderOverlay, catalogModal };
}
