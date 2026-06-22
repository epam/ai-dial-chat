import { FC, MouseEvent, ReactNode } from 'react';

import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { User } from '@/src/components/Header/User/User';

import { Logo } from './Logo';

interface Props {
  LeftItems?: ReactNode;
  RightItems?: ReactNode;
  dataQa?: string;
  onLogoClick?: (e: MouseEvent<HTMLAnchorElement>) => void;

  leftItemsWrapperClassName?: string;
  logoWrapperClassName?: string;
  rightItemsWrapperClassName?: string;
}

export const BaseHeader: FC<Props> = ({
  LeftItems,
  RightItems,
  dataQa = 'header',
  onLogoClick,
  leftItemsWrapperClassName,
  logoWrapperClassName,
  rightItemsWrapperClassName,
}) => {
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  return (
    <div
      className={classNames(
        'relative z-30 flex w-full border-b border-secondary bg-layer-1',
        isOverlay ? 'min-h-[36px]' : 'min-h-[49px]',
      )}
      data-qa={dataQa}
    >
      <div
        className={classNames(
          'flex w-1/2 items-center pe-20',
          leftItemsWrapperClassName,
        )}
      >
        {LeftItems && LeftItems}
      </div>
      <div
        className={classNames(
          'absolute left-1/2 top-0 flex h-full -translate-x-1/2 justify-center',
          logoWrapperClassName,
        )}
      >
        <Logo onLogoClick={onLogoClick} />
      </div>
      <div
        className={classNames(
          'flex w-1/2 items-center justify-end ps-20',
          rightItemsWrapperClassName,
        )}
      >
        <User />
        {RightItems && RightItems}
      </div>
    </div>
  );
};
