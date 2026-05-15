import { memo } from 'react';
import Logo from './Logo';

const Header = () => {
  return (
    <header className="relative z-30 flex min-h-[49px] w-full justify-center border-b border-secondary bg-layer-1">
      <Logo />
    </header>
  );
};

export default memo(Header);
