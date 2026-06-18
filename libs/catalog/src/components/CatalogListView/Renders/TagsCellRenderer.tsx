import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { PricingTag } from '../../PricingTag/PricingTag';

export const TagsCellRenderer: FC<ICellRendererParams<CatalogItem>> = ({
  data,
}) => {
  if (!data) return null;
  return (
    <div className="flex h-full flex-wrap items-center gap-1">
      {data.pricing.map((p) => (
        <PricingTag key={p} label={p} />
      ))}
    </div>
  );
};
