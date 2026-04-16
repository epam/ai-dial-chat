import { VirtualItem } from '@tanstack/react-virtual';
import { FC, ReactNode } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { Translation } from '@/src/types/translation';

import { SENTINEL_DATA } from '@/src/constants/marketplace';

import { SentinelRow } from '../SentinelRow';
import { MarketplaceEntitiesTableLeftSideRow } from './MarketplaceEntitiesTableLeftSideRow';
import { MarketplaceEntitiesTableRightSideRow } from './MarketplaceEntitiesTableRightSideRow';

import isString from 'lodash-es/isString';

interface DataRowItemProps {
  suggestedResults: MarketplaceEntity[];
  entity: MarketplaceEntity | string;
  virtualRow: VirtualItem;
  children: ReactNode;
  isNextSentinel: boolean;
  isPrevSentinel: boolean;
}

const DataRowItem: FC<DataRowItemProps> = ({
  entity,
  suggestedResults,
  virtualRow,
  children,
  isNextSentinel,
  isPrevSentinel,
}) => {
  const isSentinel = isString(entity);

  return (
    <div
      className={classNames(
        suggestedResults.length &&
          !isSentinel &&
          entity.id === suggestedResults[0].id &&
          '!border-t-0',
        (isSentinel || isPrevSentinel) && '!border-t-0',
        isSentinel && 'flex items-end',
        isNextSentinel && '!border-b !border-b-secondary',
        'absolute left-0 top-0 min-w-full',
      )}
      style={{
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      {children}
    </div>
  );
};

export interface RowProps {
  hoveredRowId: string;
  onClick: (entity: MarketplaceEntity) => void;
  onBookmarkClick?: (entity: MarketplaceEntity) => void;
  onRowHover: (id: string) => void;
  onRowHoverOver: () => void;
}

interface VirtualRowViewProps {
  entity: MarketplaceEntity | string;
  rowProps: RowProps;
  isLeftSide?: boolean;
}

const VirtualRowView = ({
  entity,
  rowProps: { hoveredRowId, ...rowProps },
  isLeftSide,
}: VirtualRowViewProps) => {
  const { t } = useTranslation(Translation.Marketplace);

  const RowComponent = isLeftSide
    ? MarketplaceEntitiesTableLeftSideRow
    : MarketplaceEntitiesTableRightSideRow;

  if (!isString(entity)) {
    return (
      <RowComponent
        {...rowProps}
        entity={entity}
        isHovered={entity.id === hoveredRowId}
      />
    );
  }

  if (!isLeftSide) return <span />;

  return (
    <SentinelRow dataQa={SENTINEL_DATA[entity].dataQa} isTable>
      {t(SENTINEL_DATA[entity].label)}
    </SentinelRow>
  );
};

interface VirtualRowRendererProps {
  virtualRows: VirtualItem[];
  allEntities: (MarketplaceEntity | string)[];
  suggestedResults: MarketplaceEntity[];
  rowProps: RowProps;
  isLeftSide?: boolean;
}

export const VirtualRowsRenderer: FC<VirtualRowRendererProps> = ({
  virtualRows,
  allEntities,
  suggestedResults,
  rowProps,
  isLeftSide,
}) => {
  return (
    <>
      {virtualRows.map((virtualRow) => {
        const entity = allEntities[virtualRow.index];
        const isPrevSentinel = isString(allEntities.at(virtualRow.index - 1));
        const isNextSentinel = isString(allEntities.at(virtualRow.index + 1));

        return (
          <DataRowItem
            key={virtualRow.key}
            suggestedResults={suggestedResults}
            entity={entity}
            isNextSentinel={isNextSentinel}
            isPrevSentinel={isPrevSentinel}
            virtualRow={virtualRow}
          >
            <VirtualRowView
              entity={entity}
              rowProps={rowProps}
              isLeftSide={isLeftSide}
            />
          </DataRowItem>
        );
      })}
    </>
  );
};
