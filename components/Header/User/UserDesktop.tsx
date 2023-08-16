import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Image from 'next/image';

import HomeContext from '@/pages/api/home/home.context';

import { Menu, MenuItem } from '@/components/Common/DropdownMenu';

import ChevronDownIcon from '../../../public/images/icons/chevron-down.svg';
import FileArrowRightIcon from '../../../public/images/icons/file-arrow-right.svg';
import GearIcon from '../../../public/images/icons/gear.svg';
import UserIcon from '../../../public/images/icons/user.svg';

export const UserDesktop = () => {
  const { t } = useTranslation('header');
  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();
  const { dispatch: homeDispatch } = useContext(HomeContext);
  const handleLogout = useCallback(() => {
    session ? signOut() : signIn();
  }, [session]);

  return (
    <Menu
      className="w-full"
      onOpenChange={setIsOpen}
      trigger={
        <div className="flex min-w-[120px] items-center justify-between gap-2 pr-3">
          <div className="flex items-center gap-3">
            {session?.user?.image ? (
              <Image
                className="rounded"
                src={session?.user?.image}
                width={18}
                height={18}
                alt={t(`User avatar`)}
              />
            ) : (
              <UserIcon width={18} height={18} />
            )}

            <span className="grow">{session?.user?.name || t('User')}</span>
          </div>
          <ChevronDownIcon
            className={`shrink-0 text-gray-800 transition-all dark:text-gray-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            width={18}
            height={18}
          />
        </div>
      }
    >
      <MenuItem
        className={`hover:bg-blue-500/20`}
        item={
          <div className="flex">
            <GearIcon width={18} height={18} />
            <span className="ml-3">{t('Settings')}</span>
          </div>
        }
        onClick={() => {
          homeDispatch({ field: 'isUserSettingsOpen', value: true });
        }}
      />
      <MenuItem
        className={`hover:bg-blue-500/20`}
        item={
          <div className="flex gap-3">
            <FileArrowRightIcon width={18} height={18} />
            <span>{session ? t('Log out') : t('Login')}</span>
          </div>
        }
        onClick={handleLogout}
      />
    </Menu>
  );
};
