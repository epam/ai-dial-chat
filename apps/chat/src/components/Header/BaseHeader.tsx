import classNames from 'classnames';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { Logo } from './Logo';

interface Props {
  LeftItems?: React.ReactNode;
  RightItems?: React.ReactNode;
}

export const BaseHeader: React.FC<Props> = ({ LeftItems, RightItems }) => {
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  return (
    <div
      className={classNames(
        'relative z-30 flex w-full border-b border-secondary bg-layer-1',
        isOverlay ? 'min-h-[36px]' : 'min-h-[49px]',
      )}
      data-qa="header"
    >
      {LeftItems && LeftItems}
      <div className="grow"></div>
      <div className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 justify-center">
        <Logo />
      </div>
      {RightItems && RightItems}
    </div>
  );
};
