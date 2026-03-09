/*eslint-disable @next/next/no-img-element*/
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import UserDefaultIcon from '@/public/images/icons/user.svg';

interface Props {
  iconSize?: number;
  className?: string;
  fallbackIconClassName?: string;
}

export const UserIcon = ({
  iconSize = 18,
  className,
  fallbackIconClassName,
}: Props) => {
  const { t } = useTranslation(Translation.Header);
  const { data: session } = useSession();
  const [showFallbackIcon, setShowFallbackIcon] = useState(
    !session?.user?.image,
  );

  useEffect(() => {
    if (session?.user?.image) {
      setShowFallbackIcon(false);
    }
  }, [session?.user?.image]);

  if (showFallbackIcon) {
    return (
      <UserDefaultIcon
        width={iconSize}
        height={iconSize}
        className={classNames(className, fallbackIconClassName)}
      />
    );
  }

  return (
    <img
      className={classNames('rounded', className)}
      src={session?.user?.image ?? ''}
      width={iconSize}
      height={iconSize}
      alt={t('User avatar')}
      onError={() => setShowFallbackIcon(true)}
    />
  );
};
