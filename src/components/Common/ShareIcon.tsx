import { IconArrowUpRight, IconWorldLongitude } from '@tabler/icons-react';
import { ReactNode } from 'react';

import classNames from 'classnames';

import { getByHighlightColor } from '@/src/utils/app/folders';

import { HighlightColor } from '@/src/types/common';
import { ShareInterface } from '@/src/types/share';

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
  size = !isPublished ? 12 : 8,
  children,
}: ShareIsonProps) {
  if (!isPublished && !isShared) return <>{children}</>;
  const AdditionalIcon = isPublished ? IconWorldLongitude : IconArrowUpRight;
  return (
    <div className="relative">
      {children}
      <div
        className={classNames(
          'absolute bottom-0 left-0 h-[8px] w-[8px] overflow-hidden  bg-gray-100 align-text-top dark:bg-gray-700',
          isPublished ? 'rounded-md' : 'rounded-sm',
        )}
      >
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
            !isPublished && 'm-[-2px]',
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
