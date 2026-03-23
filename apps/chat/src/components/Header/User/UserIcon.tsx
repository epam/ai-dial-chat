/*eslint-disable @next/next/no-img-element*/
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props {
  userName?: string;
  iconSize?: number;
  className?: string;
}

export const UserIcon = ({ iconSize = 28, className, userName }: Props) => {
  const { t } = useTranslation(Translation.Header);
  const { data: session } = useSession();
  const [showFallbackIcon, setShowFallbackIcon] = useState(
    !session?.user?.image,
  );

  const shortName = useMemo(() => {
    const [part1, part2] = session?.user?.name?.split(' ') ?? [];
    if (part1 && part2) {
      return `${part1[0]}${part2[0]}`;
    }

    return session?.user?.name;
  }, [session?.user?.name]);

  useEffect(() => {
    if (session?.user?.image) {
      setShowFallbackIcon(false);
    }
  }, [session?.user?.image]);

  return (
    <Tooltip tooltip={userName}>
      {showFallbackIcon ? (
        <div className="font-normal text-[12px]/[16px] flex size-[28px] items-center justify-center rounded-full bg-success">
          {shortName}
        </div>
      ) : (
        <img
          className={classNames('rounded-full', className)}
          src={session?.user?.image ?? ''}
          width={iconSize}
          height={iconSize}
          alt={t('User avatar')}
          onError={() => setShowFallbackIcon(true)}
        />
      )}
    </Tooltip>
  );
};
