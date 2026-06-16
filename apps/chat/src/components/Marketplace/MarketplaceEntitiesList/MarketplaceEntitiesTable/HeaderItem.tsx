import { IconArrowNarrowDown, IconArrowNarrowUp } from '@tabler/icons-react';
import React from 'react';

import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { fakeCallback } from '@/src/utils/app/common';

import { SortOrder } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';
import { TableColumnSortKeys } from '@/src/constants/marketplace';

import { translateMarketplaceHeaderLabel } from './translateMarketplaceHeaderLabel';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  label: string;
  sortKey?: TableColumnSortKeys;
  size?: number;
  sortOrder?: SortOrder;
  onApplySorting: (column: TableColumnSortKeys) => void;
}

export const HeaderItem: React.FC<Props> = ({
  label,
  sortKey,
  size,
  sortOrder,
  onApplySorting,
}) => {
  const { t } = useTranslation(Translation.Marketplace);
  const router = useRouter();
  const translatedLabel = translateMarketplaceHeaderLabel(
    label,
    router.locale,
    t,
  );

  const SortIcon =
    sortOrder && sortOrder === 'desc' ? IconArrowNarrowDown : IconArrowNarrowUp;

  return (
    <DialButton
      onClick={() => (!sortKey ? fakeCallback() : onApplySorting(sortKey))}
      className={classNames(
        'group flex items-center px-2.5',
        !size && 'w-full min-w-full',
        !sortKey && 'cursor-default',
      )}
      style={size ? { width: `${size}px`, minWidth: `${size}px` } : undefined}
      label={translatedLabel}
      iconAfter={
        sortKey && (
          <SortIcon
            className={
              sortOrder
                ? 'text-primary'
                : 'invisible text-secondary group-hover:visible'
            }
            size={DEFAULT_ICON_SIZES.SMALL}
          />
        )
      }
    />
  );
};
