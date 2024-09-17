import { FloatingOverlay } from '@floating-ui/react';
import { IconSearch } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

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
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { FilterTypes } from '@/src/constants/marketplace';

import { PublishModal } from '@/src/components/Chat/Publish/PublishWizard';
import { Spinner } from '@/src/components/Common/Spinner';
import { ApplicationCard } from '@/src/components/Marketplace/ApplicationCard';

import ApplicationDetails from './ApplicationDetails/ApplicationDetails';

import darkMyAppsBanner from '@/public/images/banners/welcome-dark-my-apps.jpg';
import darkBanner from '@/public/images/banners/welcome-dark.jpg';
import lightMyAppsBanner from '@/public/images/banners/welcome-light-my-apps.jpg';
import lightBanner from '@/public/images/banners/welcome-light.jpg';

enum Tabs {
  Marketplace = 'Marketplace',
  MyApps = 'MyApps',
}

const getBannerSrc = (theme: string, tab: Tabs) => {
  if (theme === 'dark') {
    return tab === Tabs.MyApps ? darkMyAppsBanner.src : darkBanner.src;
  }

  return tab === Tabs.MyApps ? lightMyAppsBanner.src : lightBanner.src;
};

const Marketplace = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const isFilterbarOpen = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);

  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const searchQuery = useAppSelector(MarketplaceSelectors.selectSearchQuery);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );
  const selectedTheme = useAppSelector(UISelectors.selectThemeState);

  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();
  const [searchTerm, setSearchTerm] = useState(searchQuery);
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
          <header>
            <div
              className="hidden rounded bg-cover bg-center bg-no-repeat py-6 md:block"
              style={{
                backgroundImage: `url(${getBannerSrc(selectedTheme, Tabs.Marketplace)})`,
              }}
            >
              <h1 className="text-center text-xl font-semibold md:visible">
                {t('Welcome to DIAL Marketplace')}
              </h1>
              <p className="mt-2 text-center">
                {t(
                  'Explore our AI offerings with your data and see how the boost your productivity!',
                )}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="hidden text-secondary md:block">
                {t('Home page: {{count}} applications', {
                  count: displayedEntities.length,
                  nsSeparator: '::',
                })}
              </div>
              <div className="relative w-full md:w-auto">
                <IconSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  size={18}
                />
                <input
                  name="titleInput"
                  placeholder={t('Search') || ''}
                  type="text"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded border-[1px] border-primary bg-transparent py-[11px] pl-[38px] pr-3 leading-4 outline-none placeholder:text-secondary focus-visible:border-accent-primary md:w-[315px] xl:w-[560px]"
                />
              </div>
            </div>
          </header>
          <section className="mt-4">
            <h2 className="text-xl font-semibold">{t('All applications')}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6 2xl:grid-cols-4">
              {displayedEntities.map((model) => (
                <ApplicationCard
                  key={model.id}
                  entity={model}
                  isMobile={isMobile}
                  onClick={setDetailsModel}
                  onPublish={handleSetPublishEntity}
                  selected={model.id === detailsModel?.id}
                />
              ))}
              {showOverlay && <FloatingOverlay className="z-30 bg-blackout" />}
            </div>
          </section>
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
