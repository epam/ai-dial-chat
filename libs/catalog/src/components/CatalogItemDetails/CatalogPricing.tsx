import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { CatalogItemPricing } from '../../models/item-details-data';
import styles from './CatalogPricing.module.scss';

/** Props for `CatalogPricing`. */
export interface CatalogPricingProps {
  /** Pricing data to render. */
  pricing: CatalogItemPricing;
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
export const CatalogPricing: FC<CatalogPricingProps> = ({
  pricing,
  pricesSectionLabel = 'Token pricing',
  limitsSectionLabel = 'Usage limits',
  labelClassName = 'dial-small-semi-text',
  valueClassName = 'dial-small-text',
  sectionClassName = 'dial-caption-text',
}) => (
  <div className="flex flex-col gap-6">
    {pricing.prices != null && pricing.prices.length > 0 && (
      <section>
        <p
          className={mergeClasses(
            'mb-3 mt-0',
            sectionClassName,
            styles.sectionHeading,
          )}
        >
          {pricesSectionLabel}
        </p>
        <ul className="m-0 list-none p-0">
          {pricing.prices.map((row, i) => (
            <li
              key={row.label}
              className={mergeClasses(
                'flex items-center px-3 py-2',
                styles.row,
                i % 2 === 0 ? styles.rowAlt : undefined,
              )}
            >
              <span
                className={mergeClasses(
                  labelClassName,
                  styles.label,
                  'w-2/5 shrink-0',
                )}
              >
                {row.label}
              </span>
              <span
                className={mergeClasses(valueClassName, styles.value, 'w-3/5')}
              >
                {row.price}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )}

    {pricing.limits != null && pricing.limits.length > 0 && (
      <section>
        <p
          className={mergeClasses(
            'mb-3 mt-0',
            sectionClassName,
            styles.sectionHeading,
          )}
        >
          {limitsSectionLabel}
        </p>
        <ul className="m-0 list-none p-0">
          {pricing.limits.map((row, i) => (
            <li
              key={row.label}
              className={mergeClasses(
                'flex items-center px-3 py-2',
                styles.row,
                i % 2 === 0 ? styles.rowAlt : undefined,
              )}
            >
              <span
                className={mergeClasses(
                  labelClassName,
                  styles.label,
                  'w-2/5 shrink-0',
                )}
              >
                {row.label}
              </span>
              <span
                className={mergeClasses(valueClassName, styles.value, 'w-3/5')}
              >
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      </section>
    )}
  </div>
);
