import { IconChevronDown, IconPlus, IconSearch } from '@tabler/icons-react';
import { ChangeEvent, useMemo, useState } from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getAppEditorRoute } from '@/src/utils/app/route';

import { ApplicationTypeSchema } from '@/src/types/application-type-schema';
import { ApplicationType } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { ApplicationTypesSchemasActions } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.reducers';
import { ApplicationTypesSchemasSelectors } from '@/src/store/applicationTypeSchemas/applicationTypeSchemas.selectors';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { MarketplaceActions } from '@/src/store/marketplace/marketplace.reducers';
import { MarketplaceSelectors } from '@/src/store/marketplace/marketplace.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import ContextMenu from '@/src/components/Common/ContextMenu';

import { ViewToggler } from './ViewToggler';

import { Feature } from '@epam/ai-dial-shared';

// const countLabel = {
//   [MarketplaceTabs.HOME]: 'DIAL Marketplace',
//   [MarketplaceTabs.MY_APPLICATIONS]: 'My workspace',
// };

interface AddAppButtonProps {
  menuItems: DisplayMenuItemProps[];
}

const AddAppButton = ({ menuItems }: AddAppButtonProps) => {
  const { t } = useTranslation(Translation.Marketplace);
  const [isOpen, setIsOpen] = useState(false);

  const visibleActions = useMemo(() => {
    return menuItems.filter((item) => item.display);
  }, [menuItems]);

  if (!visibleActions.length) return null;

  if (visibleActions.length === 1)
    return (
      <button
        onClick={visibleActions[0].onClick}
        className="button button-primary hidden items-center gap-2 py-2 xl:flex"
      >
        <IconPlus size={18} />
        <span>{t('Add app')}</span>
      </button>
    );

  return (
    <ContextMenu
      menuItems={menuItems}
      featureType={FeatureType.Application}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom"
      triggerIconClassName="max-md:hidden"
      TriggerCustomRenderer={
        <button
          className="button button-primary flex items-center gap-2 py-2"
          data-qa="add-app"
        >
          <span>{t('Add app')}</span>
          <IconChevronDown
            size={18}
            className={classNames(isOpen && 'rotate-180')}
          />
        </button>
      }
    />
  );
};

interface MenuItem {
  type: ApplicationType | string;
  name: string;
  dataQa: string;
  display: boolean;
}

export const SearchHeader = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();
  const router = useRouter();

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );

  const isCustomApplicationsEnabled = enabledFeatures.has(
    Feature.CustomApplications,
  );
  const isCodeAppsEnabled = enabledFeatures.has(Feature.CodeApps);

  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);
  const applicationTypeSchemas = useAppSelector(
    ApplicationTypesSchemasSelectors.selectAllSchemas,
  );
  const detailedApplicationTypeSchema = useAppSelector(
    ApplicationTypesSchemasSelectors.selectDetailedApplicationTypeSchema,
  );

  const menuItems: MenuItem[] = useMemo(
    () =>
      [
        {
          name: t('Custom app'),
          type: ApplicationType.CUSTOM_APP,
          dataQa: 'add-custom-app',
          display: isCustomApplicationsEnabled,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(ApplicationActions.setShouldSaveApplication(false));
            router.push(getAppEditorRoute(ApplicationType.CUSTOM_APP));
          },
        },
        {
          name: t('Code app'),
          dataQa: 'add-startable-app',
          type: ApplicationType.CODE_APP,
          display: isCodeAppsEnabled,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(ApplicationActions.setShouldSaveApplication(false));
            router.push(getAppEditorRoute(ApplicationType.CODE_APP));
          },
        },
        ...(applicationTypeSchemas?.map((schema: ApplicationTypeSchema) => ({
          name: t(schema.displayName),
          type: schema.displayName,
          dataQa: `add-${schema.displayName}`,
          display: true,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            dispatch(ApplicationActions.setShouldSaveApplication(false));
            if (detailedApplicationTypeSchema?.$id !== schema.id) {
              dispatch(
                ApplicationTypesSchemasActions.fetchDetailedApplicationTypeSchema(
                  schema.id,
                ),
              );
            }
            router.push(getAppEditorRoute(schema.id));
          },
        })) ?? []),
      ].sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1)),
    [
      t,
      isCustomApplicationsEnabled,
      isCodeAppsEnabled,
      applicationTypeSchemas,
      router,
      detailedApplicationTypeSchema?.$id,
      dispatch,
    ],
  );

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch(MarketplaceActions.setSearchTerm(e.target.value));
  };

  return (
    <div className="flex w-full gap-2 sm:justify-end md:w-auto">
      <div className="relative flex h-[38px] shrink-0 grow sm:w-[315px] md:w-[440px] lg:w-[500px]">
        <IconSearch
          className="absolute left-3 top-1/2 -translate-y-1/2"
          size={18}
        />
        <input
          name="titleInput"
          placeholder={t('Search')}
          type="text"
          value={searchTerm}
          onChange={onSearchChange}
          className="grow rounded border border-primary bg-transparent py-2.5 pl-[38px] pr-3 leading-4 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
        />
      </div>
      {enabledFeatures.has(Feature.MarketplaceTableView) && <ViewToggler />}
      {selectedTab === MarketplaceTabs.MY_WORKSPACE && (
        <AddAppButton menuItems={menuItems} />
      )}
    </div>
  );
};
