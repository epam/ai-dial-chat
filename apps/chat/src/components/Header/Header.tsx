import { memo } from 'react';
import UserMenu from '../auth/UserMenu';
import Logo from './Logo';

const Header = () => {
  return (
    <header className="relative z-30 flex min-h-[49px] w-full items-center border-b border-secondary bg-layer-1">
      <div className="flex flex-1 justify-center">
        <Logo />
      </div>
      <div className="absolute right-2">
        <UserMenu />
      </div>
    </header>
  );
};

export default memo(Header);
