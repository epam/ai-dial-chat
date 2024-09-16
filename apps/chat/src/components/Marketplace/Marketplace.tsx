import { FloatingOverlay } from '@floating-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';
import { useSearchParams } from 'next/navigation';

import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isSmallScreen } from '@/src/utils/app/mobile';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';
import { ApiUtils } from '@/src/utils/server/api';

import { ShareEntity } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

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

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { Spinner } from '@/src/components/Common/Spinner';
import { CardsList } from '@/src/components/Marketplace/CardsList';
import { SearchHeader } from '@/src/components/Marketplace/SearchHeader';

import ApplicationDetails from './ApplicationDetails/ApplicationDetails';

const Marketplace = () => {
  const { t } = useTranslation(Translation.Marketplace);

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

  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();
  const [publishModel, setPublishModel] = useState<{
    entity: ShareEntity;
    action: PublishActions;
  }>();
  const [isMobile, setIsMobile] = useState(isSmallScreen());

  const handleSetPublishEntity = useCallback(
    (entity: DialAIEntityModel, action: PublishActions) =>
      setPublishModel({
        entity: {
          name: entity.name,
          id: ApiUtils.decodeApiUrl(entity.id),
          folderId: getFolderIdFromEntityId(entity.id),
        },
        action,
      }),
    [],
  );

  const handlePublishClose = useCallback(() => setPublishModel(undefined), []);

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
        (doesEntityContainSearchTerm(entity, searchTerm) &&
          !selectedFilters[FilterTypes.ENTITY_TYPE].length) ||
        selectedFilters[FilterTypes.ENTITY_TYPE].includes(entity.type),
    );

    const grouped = groupModelsAndSaveOrder(filteredEntities).slice(
      0,
      Number.MAX_SAFE_INTEGER,
    );

    return grouped.map(({ entities }) => entities[0]);
  }, [models, searchTerm, selectedFilters]);

  return (
    <div className="grow overflow-auto px-6 py-4 xl:px-16">
      {isModelsLoading ? (
        <div className="flex h-full items-center justify-center">
          <Spinner size={60} className="mx-auto" />
        </div>
      ) : (
        <>
          <header className="mb-4">
            <div className="bg-accent-primary-alpha py-6">
              <h1 className="text-center text-xl font-semibold">
                {t('Welcome to DIAL Marketplace')}
              </h1>
              <p className="mt-2 text-center">
                {t(
                  'Explore our AI offerings with your data and see how the boost your productivity!',
                )}
              </p>
            </div>
            <SearchHeader items={displayedEntities.length} />
          </header>

          <CardsList
            entities={displayedEntities}
            onCardClick={setDetailsModel}
            onPublish={handleSetPublishEntity}
            isMobile={isMobile}
            title="All applications"
          />

          {showOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
          {detailsModel && (
            <ApplicationDetails
              onPublish={handleSetPublishEntity}
              isMobileView={isMobile}
              entity={detailsModel}
              onClose={() => setDetailsModel(undefined)}
            />
          )}
        </>
      )}

      {!!(publishModel && publishModel?.entity?.id) && (
        <PublishModal
          entity={publishModel.entity}
          type={SharingType.Application}
          isOpen={!!publishModel}
          onClose={handlePublishClose}
          publishAction={publishModel.action}
        />
      )}
    </div>
  );
};

export default Marketplace;
