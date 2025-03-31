import { ProfileButton } from './ProfileButton';
import { UserDesktop } from './UserDesktop';

export const User = () => {
  return (
    <>
      <div className="flex h-full items-center justify-center md:hidden">
        <ProfileButton />
      </div>

      <div className="hidden size-full md:block">
        <UserDesktop />
      </div>
    </>
  );
};
