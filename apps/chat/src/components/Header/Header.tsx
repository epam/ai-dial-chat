import { memo } from 'react';
import Logo from './Logo';

/**
 * Header component that displays the application header with logo.
 * Positioned at the top of the application with border styling.
 */
const Header = () => {
  return (
    <header className="relative z-30 flex min-h-[49px] w-full justify-center border-b border-secondary bg-layer-1">
      <Logo />
    </header>
  );
};

export default memo(Header);
