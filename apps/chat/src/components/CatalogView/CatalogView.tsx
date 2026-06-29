/* eslint-disable @typescript-eslint/no-empty-function */
import { Catalog, CatalogItem, CreateOption } from '@epam/ai-dial-catalog';
import { DIAL_ICON_SIZE, NotificationVariant } from '@epam/ai-dial-ui-kit';
import { IconSparkles, IconTools } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { MOCK_CATALOG_ITEMS } from './mock-catalog-items';

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const [mockItems, setMockItems] = useState(MOCK_CATALOG_ITEMS);

  const isLoading = false;

  const favorites = useMemo(
    () => mockItems.filter((item) => item.isUserFavorite),
    [mockItems],
  );

  const filteredItems = useMemo(() => mockItems, [mockItems]);

  // TODO: replace with a real API call, e.g. GET /api/catalog/{id}/about
  const fetchAboutContent = useCallback(
    (item: CatalogItem): Promise<string | undefined> => {
      return Promise.resolve(undefined);
    },
    [],
  );

  const onToggleFavorite = useCallback(
    (id: string, isFavorite: boolean) => {
      if (isLoading) return;
      setMockItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isUserFavorite: isFavorite } : item,
        ),
      );
      const name = mockItems.find((item) => item.id === id)?.name ?? id;

      showNotification({
        variant: isFavorite
          ? NotificationVariant.Success
          : NotificationVariant.Info,
        title: t(
          isFavorite
            ? CatalogI18nKeys.FavoriteAddedTitle
            : CatalogI18nKeys.FavoriteRemovedTitle,
        ),
        message: t(
          isFavorite
            ? CatalogI18nKeys.FavoriteAdded
            : CatalogI18nKeys.FavoriteRemoved,
          { name },
        ),
      });
    },
    [isLoading, mockItems, showNotification, t],
  );

  const createOptions = useMemo<CreateOption[]>(
    () => [
      {
        label: t(CatalogI18nKeys.CreateQuickApp),
        description: t(CatalogI18nKeys.CreateQuickAppDescription),
        icon: <IconSparkles size={DIAL_ICON_SIZE.MD} />,
        iconContainerClassName: 'bg-accent-secondary-alpha text-accent-secondary',
        onClick: () => {},
      },
      {
        label: t(CatalogI18nKeys.CreateToolset),
        description: t(CatalogI18nKeys.CreateToolsetDescription),
        icon: <IconTools size={DIAL_ICON_SIZE.MD} />,
        iconContainerClassName: 'bg-accent-primary-alpha text-accent-primary',
        onClick: () => {},
      },
    ],
    [t],
  );

  return (
    <Catalog
      items={filteredItems}
      isLoading={isLoading}
      favorites={favorites}
      createOptions={createOptions}
      onFetchAboutContent={fetchAboutContent}
      onToggleFavorite={onToggleFavorite}
      titles={{
        pageTitle: t(CatalogI18nKeys.PageTitle),
        createLabel: t(ButtonsI18nKeys.Create),
        favoritesTitle: t(CatalogI18nKeys.FavoritesTitle),
        browseTitle: t(ButtonsI18nKeys.Browse),
        searchPlaceholder: t(CatalogI18nKeys.SearchPlaceholder),
        noResultsTitle: (query) => t(CatalogI18nKeys.NoResultsTitle, { query }),
        sortRecentlyUpdatedLabel: t(CatalogI18nKeys.SortRecentlyUpdated),
        sortNewestLabel: t(CatalogI18nKeys.SortNewest),
        sortNameAZLabel: t(CatalogI18nKeys.SortNameAZ),
        featuredLabel: t(CatalogI18nKeys.FeaturedLabel),
        ariaLabel: t(CatalogI18nKeys.AriaLabel),
      }}
      styles={{ colors: { background: '#F5F7FA' }, typography: { pageHeadingFontClassName: 'dial-h1-text' } }}
      detailsTexts={{
        tabToolsLabel: t(CatalogI18nKeys.DetailsTabTools),
        primaryActionLabel: t(ButtonsI18nKeys.UseInChat),
        dailyLimitLabel: t(CatalogI18nKeys.DetailsDailyLimit),
        apiResourceSectionLabel: t(CatalogI18nKeys.DetailsApiResourceSection),
        apiSnippetSectionLabel: t(CatalogI18nKeys.DetailsApiSnippetSection),
        apiModelIdLabel: t(CatalogI18nKeys.DetailsApiModelId),
        apiEndpointLabel: t(CatalogI18nKeys.DetailsApiEndpoint),
        apiRequestExampleLabel: t(CatalogI18nKeys.DetailsApiRequestExample),
        apiResponseSchemaLabel: t(CatalogI18nKeys.DetailsApiResponseSchema),
        copyCodeAriaLabel: t(CatalogI18nKeys.DetailsApiCopy),
        pricingPricesSectionLabel: t(
          CatalogI18nKeys.DetailsPricingPricesSection,
        ),
        pricingLimitsSectionLabel: t(
          CatalogI18nKeys.DetailsPricingLimitsSection,
        ),
      }}
    />
  );
};

export default memo(CatalogView);
