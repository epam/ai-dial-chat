import { IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { groupModelsAndSaveOrder } from '@/src/utils/app/conversation';
import { doesEntityContainSearchTerm } from '@/src/utils/app/search';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.reducers';
import {
  ModelsActions,
  ModelsSelectors,
} from '@/src/store/models/models.reducers';

import { FilterTypes } from '@/src/constants/marketplace';

import { Spinner } from '@/src/components/Common/Spinner';

import ApplicationDetails from './ApplicationDetails/ApplicationDetails';

const Marketplace = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const isModelsLoading = useAppSelector(ModelsSelectors.selectModelsIsLoading);
  const isModelsLoaded = useAppSelector(ModelsSelectors.selectIsModelsLoaded);
  const models = useAppSelector(ModelsSelectors.selectModels);
  const searchQuery = useAppSelector(MarketplaceSelectors.selectSearchQuery);
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );

  const [detailsModel, setDetailsModel] = useState<DialAIEntityModel>();
  const [searchTerm, setSearchTerm] = useState(searchQuery);

  useEffect(() => {
    if (!isModelsLoaded && !isModelsLoading) {
      dispatch(ModelsActions.getModels());
    }
  }, [isModelsLoaded, isModelsLoading, dispatch]);

  const displayedEntities = useMemo(() => {
    const filteredEntities = models.filter(
      (entity) =>
        doesEntityContainSearchTerm(entity, searchTerm) &&
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
        <Spinner size={60} className="mx-auto" />
      ) : (
        <>
          <header>
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
            <div className="mt-4 flex items-center justify-between">
              <div className="text-secondary">
                {t('Home page: {{count}} applications', {
                  count: displayedEntities.length,
                  nsSeparator: '::',
                })}
              </div>
              <div className="relative">
                <IconSearch
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  size={18}
                />
                <input
                  name="titleInput"
                  placeholder={t('Search') || ''}
                  type="text"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-[560px] rounded border-[1px] border-primary bg-transparent py-[11px] pl-[38px] pr-3 leading-4 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
                />
              </div>
            </div>
          </header>
          <section className="mt-4">
            <h2 className="text-xl font-semibold">{t('All applications')}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
              {displayedEntities.map((entity) => (
                <div
                  key={entity.id}
                  onClick={() => setDetailsModel(entity)}
                  className="h-[92px] cursor-pointer rounded border border-primary bg-transparent p-4 md:h-[203px] xl:h-[207px]"
                >
                  {entity.name}
                </div>
              ))}
            </div>
          </section>
          {detailsModel && (
            <ApplicationDetails
              entity={detailsModel}
              onClose={() => setDetailsModel(undefined)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default Marketplace;
