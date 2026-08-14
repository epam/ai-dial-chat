/** Pricing unit that is quoted per 1M units instead of per single unit. */
const TOKEN_PRICING_UNIT = 'token';
const TOKENS_PER_QUOTED_PRICE = 1_000_000;

/*
 * Prices are quoted in USD, so the locale is pinned to `en-US` — the browser
 * locale would render the same amount as `US$5` (en-GB) or `5,00 $` (ru-RU).
 */
const PRICE_LOCALE = 'en-US';

const priceFormatter = new Intl.NumberFormat(PRICE_LOCALE, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const smallPriceFormatter = new Intl.NumberFormat(PRICE_LOCALE, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
});

/** Formats an amount as USD, keeping up to six decimals for sub-dollar values (e.g. `$3`, `$0.3`). */
export const formatPrice = (value: number): string => {
  if (value !== 0 && Math.abs(value) < 1) {
    return smallPriceFormatter.format(value);
  }
  return priceFormatter.format(value);
};

/*
 * DIAL Core quotes prices per single unit (for example `'0.000003'` per token),
 * which is unreadable in a table, so token prices are re-quoted per 1M tokens
 * (`$3/M tokens`) — the convention model-pricing pages use. Non-token units
 * (for example `char_without_whitespace`) keep their per-unit price and name
 * the unit. A missing unit is treated as tokens, DIAL Core's default.
 */
/** Formats a per-unit price string for display, e.g. `$3/M tokens` or `$0.5/char without whitespace`. */
export const formatUnitPrice = (
  price: string | undefined,
  unit: string | undefined,
): string | undefined => {
  if (price == null) return undefined;

  const perUnit = Number(price);
  if (price.trim() === '' || !Number.isFinite(perUnit)) return price;

  if (unit == null || unit.toLowerCase() === TOKEN_PRICING_UNIT) {
    return `${formatPrice(perUnit * TOKENS_PER_QUOTED_PRICE)}/M tokens`;
  }

  return `${formatPrice(perUnit)}/${unit.replace(/_/g, ' ')}`;
};
