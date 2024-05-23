import { ProfileButton } from './ProfileButton';
import { UserDesktop } from './UserDesktop';

export const User = () => {
  return (
    <>
      <div className="h-full md:hidden">
        <ProfileButton />
      </div>

      <div className="hidden size-full md:flex">
        <UserDesktop />
      </div>
    </>
  );
};
