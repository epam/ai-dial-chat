import {
  IconArrowLeft,
  IconCheck,
  IconChevronUp,
  IconHome,
  TablerIconsProps,
} from '@tabler/icons-react';
import { JSX, useState } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  MarketplaceActions,
  MarketplaceSelectors,
} from '@/src/store/marketplace/marketplace.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { FilterTypes } from '@/src/constants/marketplace';

import { capitalize } from 'lodash';

interface FilterItemProps {
  type: FilterTypes;
  filterValue: string;
  selected: boolean;
  displayValue?: string;
  onSelect: (type: FilterTypes, value: string) => void;
}

const FilterItem = ({
  type,
  filterValue,
  selected,
  displayValue,
  onSelect,
}: FilterItemProps) => {
  return (
    <div className="relative flex size-[18px] shrink-0 items-center">
      <input
        className="checkbox peer size-[18px] bg-layer-3"
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(type, filterValue)}
      />
      <IconCheck
        size={18}
        className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
      />
      <span className="ml-2 text-sm">{displayValue ?? filterValue}</span>
    </div>
  );
};

const entityTypes = [
  EntityType.Model,
  EntityType.Assistant,
  EntityType.Application,
];

interface ActionButtonProps {
  isOpen: boolean;
  onClick: () => void;
  caption: string;
  Icon: (props: TablerIconsProps) => JSX.Element;
}

const ActionButton = ({
  isOpen,
  onClick,
  caption,
  Icon,
}: ActionButtonProps) => {
  return (
    <div className="flex px-2 py-1">
      <button
        onClick={onClick}
        className="flex min-h-9 shrink-0 grow cursor-pointer select-none items-center gap-3 rounded px-4 py-2 transition-colors duration-200 hover:bg-accent-primary-alpha hover:disabled:bg-transparent"
      >
        <Icon className="text-secondary" width={18} height={18} />
        {isOpen ? caption : ''}
      </button>
    </div>
  );
};

const MarketplaceFilterbar = () => {
  const { t } = useTranslation(Translation.SideBar);

  const dispatch = useAppDispatch();

  const router = useRouter();

  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const selectedFilters = useAppSelector(
    MarketplaceSelectors.selectSelectedFilters,
  );

  const [openedSections, setOpenedSections] = useState({
    [FilterTypes.ENTITY_TYPE]: true,
    // [FilterTypes.CAPABILITIES]: false,
    // [FilterTypes.ENVIRONMENT]: false,
    // [FilterTypes.TOPICS]: false,
  });

  const handleApplyFilter = (type: FilterTypes, value: string) => {
    dispatch(
      MarketplaceActions.setSelectedFilters({ filterType: type, value }),
    );
  };

  const onHomeClick = () => {
    // filler
  };

  return (
    <nav
      className={classNames(
        showFilterbar ? 'w-[284px]' : 'invisible md:visible md:w-[64px]',
        'group/sidebar absolute left-0 top-0 h-full flex-col gap-px divide-y divide-tertiary bg-layer-3 md:sticky',
      )}
    >
      <div>
        <ActionButton
          isOpen={showFilterbar}
          onClick={() => router.push('/')}
          caption={t('Back to Chat')}
          Icon={IconArrowLeft}
        />
        <ActionButton
          isOpen={showFilterbar}
          onClick={onHomeClick}
          caption={t('Home page')}
          Icon={IconHome}
        />
      </div>
      <div className="px-5 py-2.5">
        <button
          onClick={() =>
            setOpenedSections((state) => ({
              ...openedSections,
              [FilterTypes.ENTITY_TYPE]: !state[FilterTypes.ENTITY_TYPE],
            }))
          }
          className="flex w-full justify-between font-semibold"
        >
          <h5 className="text-sm">{t('Type')}</h5>
          <IconChevronUp
            className={classNames(
              'duration-200',
              !openedSections[FilterTypes.ENTITY_TYPE] && 'rotate-180',
            )}
            size={18}
          />
        </button>
        {openedSections[FilterTypes.ENTITY_TYPE] && (
          <div className="mt-3.5 flex flex-col gap-3.5">
            {entityTypes.map((type) => (
              <FilterItem
                key={type}
                type={FilterTypes.ENTITY_TYPE}
                filterValue={type}
                displayValue={`${capitalize(type)}s`}
                onSelect={handleApplyFilter}
                selected={selectedFilters[FilterTypes.ENTITY_TYPE].includes(
                  type,
                )}
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default MarketplaceFilterbar;
