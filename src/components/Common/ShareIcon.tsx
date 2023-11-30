import { ReactNode } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { HighlightColor } from '@/src/types/common';
import { ShareInterface } from '@/src/types/share';

import ArrowUpRight from '@/public/images/icons/arrow-up-right.svg';
import World from '@/public/images/icons/world.svg';

interface ShareIsonProps extends ShareInterface {
  isHighlited: boolean;
  highlightColor: HighlightColor;
  size?: number;
  children: ReactNode | ReactNode[];
}

export default function ShareIcon({
  isShared,
  isPublished,
  isHighlited,
  highlightColor,
  size = 10,
  children,
}: ShareIsonProps) {
  if (!isPublished && !isShared) return <>{children}</>;
  const AdditionalIcon = isPublished ? World : ArrowUpRight;
  return (
    <div className="relative">
      {children}
      <div className="absolute bottom-[-2px] left-[-2px] bg-gray-100 dark:bg-gray-700">
        <AdditionalIcon
          size={size}
          width={size}
          height={size}
          className={classNames(
            getByHighlightColor(
              highlightColor,
              'text-green group-hover:bg-green/15',
              'text-violet group-hover:bg-violet/15',
              'text-blue-500 group-hover:bg-blue-500/20',
            ),
            'p-[1px]',
            isHighlited &&
              getByHighlightColor(
                highlightColor,
                'bg-green/15',
                'bg-violet/15',
                'bg-blue-500/20',
              ),
          )}
        />
      </div>
    </div>
  );
}
