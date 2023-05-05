import { IconLogin, IconLogout, IconUser } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { FC, useCallback } from 'react';

import { useTranslation } from 'next-i18next';
import Image from 'next/image';

import { SidebarButton } from '../Sidebar/SidebarButton';

const UserIcon: FC<{ image?: string | null; title?: string | null }> = ({
  image,
  title,
}) => {
  if (image) {
    return (
      <Image
        src={image}
        alt={title ?? ''}
        width={32}
        height={32}
        className="rounded-full"
      />
    );
  }

  return <IconUser />;
};

export const User: FC = () => {
  const { data: session } = useSession();
  const { t } = useTranslation('sidebar');
  const onClick = useCallback(() => {
    session
      ? signOut({ redirect: false })
      : signIn('azure-ad', { redirect: true });
  }, [session]);

  return (
    <div className="flex items-center gap-2 w-full">
      {session && (
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <UserIcon image={session?.user?.image} title={session?.user?.name} />
          {session?.user?.name ?? ''}
        </div>
      )}
      <SidebarButton
        onClick={onClick}
        className={session ? 'w-12' : ''}
        icon={session ? <IconLogout /> : <IconLogin />}
        text={session ? '' : t('Sign In')}
      />
    </div>
  );
};
