import { FloatingOverlay } from '@floating-ui/react';
import { useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'next/navigation';

import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import {
  FilterTypes,
  MarketplaceQueryParams,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { Spinner } from '@/src/components/Common/Spinner';
import { TabRenderer } from '@/src/components/Marketplace/TabRenderer';

const Marketplace = () => {
  const dispatch = useAppDispatch();

  const searchParams = useSearchParams();

  const isFilterbarOpen = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);
  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );

  const [isMobile, setIsMobile] = useState(isSmallScreen());

  const showOverlay = (isFilterbarOpen || isProfileOpen) && isSmallScreen();

  useEffect(() => {
    const handleResize = () => setIsMobile(isSmallScreen());
    const resizeObserver = new ResizeObserver(handleResize);

    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    dispatch(ModelsActions.getModels());
  }, [dispatch]);
  useEffect(() => {
    dispatch(
      MarketplaceActions.setSelectedTab(
        searchParams.get(MarketplaceQueryParams.fromConversation)
          ? MarketplaceTabs.MY_APPLICATIONS
          : MarketplaceTabs.HOME,
      ),
    );
  }, [dispatch, searchParams]);

  const displayedEntities = useMemo(() => {
    const filteredEntities = models.filter(
      (entity) =>
        doesEntityContainSearchTerm(entity, searchTerm) &&
        (selectedFilters[FilterTypes.ENTITY_TYPE].length
          ? selectedFilters[FilterTypes.ENTITY_TYPE].includes(entity.type)
          : true),
    );

    const grouped = groupModelsAndSaveOrder(filteredEntities).slice(
      0,
      Number.MAX_SAFE_INTEGER,
    );

    return grouped.map(({ entities }) => entities[0]);
  }, [models, searchTerm, selectedFilters]);

  return (
    <div
      className="grow overflow-auto px-6 py-4 xl:px-16"
      data-qa="marketplace"
    >
      {isModelsLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={60} className="mx-auto" />
        </div>
      ) : (
        <>
          <TabRenderer entities={displayedEntities} isMobile={isMobile} />

          {showOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
        </>
      )}
    </div>
  );
};

export default Marketplace;
