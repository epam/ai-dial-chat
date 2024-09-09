/* eslint-disable tailwindcss/no-custom-classname */
import { ComponentType } from 'react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import classnames from 'classnames';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import ArrowIcon from '../../../public/images/icons/arrow-left.svg';
import HomeIcon from '../../../public/images/icons/home.svg';

interface ActionButtonProps {
  isOpen: boolean;
  onClick: () => void;
  caption: string;
  Icon: ComponentType;
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
        {/* @ts-expect-error-next-line */}
        <Icon className="text-secondary" width={18} height={18} />
        {isOpen ? caption : ''}
      </button>
    </div>
  );
};

const MarketplaceFilterbar = () => {
  const router = useRouter();
  const { t } = useTranslation(Translation.SideBar);
  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );

  const onHomeClick = () => {
    // filler
  };

  return (
    <div
      className={classnames(
        showFilterbar ? 'w-[284px]' : 'invisible md:visible md:w-[64px]',
        'group/sidebar absolute left-0 top-0 h-full flex-col gap-px divide-y divide-tertiary bg-layer-3 md:sticky',
      )}
    >
      <ActionButton
        isOpen={showFilterbar}
        onClick={() => router.push('/')}
        caption={t('Back to chats')}
        Icon={ArrowIcon}
      />
      <ActionButton
        isOpen={showFilterbar}
        onClick={onHomeClick}
        caption={t('Home page')}
        Icon={HomeIcon}
      />
    </div>
  );
};

export default MarketplaceFilterbar;
