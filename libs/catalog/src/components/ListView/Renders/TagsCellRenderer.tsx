import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { TopicTag } from '../../TopicTag/TopicTag';

export const TagsCellRenderer: FC<ICellRendererParams<CatalogItem>> = ({
  data,
}) => {
  if (!data) return null;
  return (
    <div className="flex h-full flex-wrap items-center gap-1">
      {data.topics.map((t) => (
        <TopicTag key={t} label={t} />
      ))}
    </div>
  );
};
