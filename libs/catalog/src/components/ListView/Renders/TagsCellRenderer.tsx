import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { TopicsLine } from '../../TopicTag/TopicTag';

/** ag-grid cell renderer for the topics/tags column. */
export const TagsCellRenderer: FC<ICellRendererParams<CatalogItem>> = ({
  data,
}) => {
  if (!data || data.topics.length === 0) return null;

  return (
    <div className="flex h-full items-center">
      <TopicsLine topics={data.topics} />
    </div>
  );
};
