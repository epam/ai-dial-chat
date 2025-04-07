import { useSession } from 'next-auth/react';
import React from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import UserIcon from '@/public/images/icons/user.svg';

interface Props {
  iconSize?: number;
}

const avatarText = 'User avatar';

export const UserAvatar: React.FC<Props> = ({ iconSize = 24 }) => {
  const { t } = useTranslation(Translation.Common);

  const { data: session } = useSession();

  if (session?.user?.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="rounded"
        src={session?.user?.image}
        width={iconSize}
        height={iconSize}
        alt={t(avatarText) ?? avatarText}
      />
    );
  }

  return <UserIcon width={iconSize} height={iconSize} />;
};
