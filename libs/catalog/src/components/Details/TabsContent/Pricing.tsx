import { FC } from 'react';
import type { CatalogItemPricing } from '../../../models/item-details-data';
import { TableView } from '../../TableView/TableView';

/** Props for `Pricing`. */
export interface PricingProps {
  /** Pricing data to render. */
  pricing?: CatalogItemPricing;
  /** "Token pricing" section heading. Default: `'Token pricing'`. */
  pricesSectionLabel?: string;
  /** "Usage limits" section heading. Default: `'Usage limits'`. */
  limitsSectionLabel?: string;
  /** CSS class for row labels. Defaults to `'dial-small-semi-text'`. */
  labelClassName?: string;
  /** CSS class for row values. Defaults to `'dial-small-text'`. */
  valueClassName?: string;
  /** CSS class for section headings. Defaults to `'dial-caption-text'`. */
  sectionClassName?: string;
}

/** Renders the Pricing tab: token price rows and usage-limit rows. */
export const Pricing: FC<PricingProps> = ({
  pricing,
  pricesSectionLabel = 'Token pricing',
  limitsSectionLabel = 'Usage limits',
  labelClassName = 'dial-small-semi-text',
  valueClassName = 'dial-small-text',
  sectionClassName = 'dial-caption-text',
}) => {
  if (pricing == null) {
    return null;
  }

  const convertedPrices = pricing.prices?.map((row) => ({
    label: row.label,
    value: row.price,
  }));
  const convertedLimits = pricing.limits?.map((row) => ({
    label: row.label,
    value: row.value,
  }));
  return (
    <div className="flex flex-col gap-4">
      <TableView
        sectionLabel={pricesSectionLabel}
        values={convertedPrices ?? []}
        labelClassName={labelClassName}
        valueClassName={valueClassName}
        sectionClassName={sectionClassName}
      />
      <TableView
        sectionLabel={limitsSectionLabel}
        values={convertedLimits ?? []}
        labelClassName={labelClassName}
        valueClassName={valueClassName}
        sectionClassName={sectionClassName}
      />
    </div>
  );
};
