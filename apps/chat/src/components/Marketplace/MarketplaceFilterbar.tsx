import {
  IconArrowLeft,
  IconCheck,
  IconChevronUp,
  IconHome,
  TablerIconsProps,
} from '@tabler/icons-react';
import { JSX } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classnames from 'classnames';

import { EntityType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

enum FilterTypes {
  ENTITY_TYPE,
  TOPICS,
  CAPABILITIES,
  ENVIRONMENT,
}

interface FilterItemProps {
  type: FilterTypes;
  filter: string;
  onSelect: (type: FilterTypes, value: string) => void;
  selected: boolean;
}

const FilterItem = ({ type, filter, onSelect, selected }: FilterItemProps) => {
  return (
    <div className="relative flex size-[18px] shrink-0 items-center">
      <input
        className="checkbox peer size-[18px] bg-layer-3"
        type="checkbox"
        checked={selected}
        onChange={() => onSelect(type, filter)}
      />
      <IconCheck
        size={18}
        className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
      />
      <span>{filter}</span>
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

  const router = useRouter();

  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );

  const handleApplyFilter = (type: FilterTypes, value: string) => {};

  const onHomeClick = () => {
    // filler
  };

  return (
    <nav
      className={classnames(
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
        <button className="flex w-full justify-between font-semibold">
          <h5>Type</h5>
          <IconChevronUp size={18} />
        </button>
        <div>
          {entityTypes.map((type) => (
            <FilterItem
              key={type}
              type={FilterTypes.ENTITY_TYPE}
              filter={type}
              onSelect={handleApplyFilter}
              selected={false}
            />
          ))}
        </div>
      </div>
    </nav>
  );
};

export default MarketplaceFilterbar;
