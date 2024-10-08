import { IconChevronDown, IconPlus, IconSearch } from '@tabler/icons-react';
import { ChangeEvent, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { ApplicationType } from '@/src/types/applications';
import { FeatureType } from '@/src/types/common';
import { DisplayMenuItemProps } from '@/src/types/menu';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { MarketplaceTabs } from '@/src/constants/marketplace';

import ContextMenu from '@/src/components/Common/ContextMenu';

import { Feature } from '@epam/ai-dial-shared';

const countLabel = {
  [MarketplaceTabs.HOME]: 'Home page',
  [MarketplaceTabs.MY_APPLICATIONS]: 'My applications',
};

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
        className="button button-primary hidden items-center gap-2 md:flex"
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
      TriggerCustomRenderer={
        <button className="button button-primary hidden items-center gap-2 md:flex">
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

interface SearchHeaderProps {
  items: number;
  onAddApplication: (type: ApplicationType) => void;
}

export const SearchHeader = ({
  items,
  onAddApplication,
}: SearchHeaderProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const dispatch = useAppDispatch();

  const isCustomApplicationsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomApplications),
  );
  const isQuickAppsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.QuickApps),
  );

  const searchTerm = useAppSelector(MarketplaceSelectors.selectSearchTerm);
  const selectedTab = useAppSelector(MarketplaceSelectors.selectSelectedTab);

  const menuItems: DisplayMenuItemProps[] = useMemo(
    () => [
      {
        name: t('Custom App'),
        dataQa: 'add-custom-app',
        display: isCustomApplicationsEnabled,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onAddApplication(ApplicationType.CUSTOM_APP);
        },
      },
      {
        name: t('Quick App'),
        dataQa: 'add-quick-app',
        display: isQuickAppsEnabled,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onAddApplication(ApplicationType.QUICK_APP);
        },
      },
    ],
    [onAddApplication, t, isCustomApplicationsEnabled, isQuickAppsEnabled],
  );

  const onSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch(MarketplaceActions.setSearchTerm(e.target.value));
  };

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="hidden text-secondary sm:block">
        {t('{{label}}: {{count}} applications', {
          count: items,
          label: countLabel[selectedTab],
          nsSeparator: '::',
        })}
      </div>
      <div className="flex gap-4">
        <div className="relative h-10 w-full shrink-0 sm:w-[315px] md:w-[560px]">
          <IconSearch
            className="absolute left-3 top-1/2 -translate-y-1/2"
            size={18}
          />
          <input
            name="titleInput"
            placeholder={t('Search') || ''}
            type="text"
            value={searchTerm}
            onChange={onSearchChange}
            className="w-full rounded border-[1px] border-primary bg-transparent py-[11px] pl-[38px] pr-3 leading-4 outline-none placeholder:text-secondary focus-visible:border-accent-primary"
          />
        </div>
        {selectedTab === MarketplaceTabs.MY_APPLICATIONS && (
          <AddAppButton menuItems={menuItems} />
        )}
      </div>
    </div>
  );
};
