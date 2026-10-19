/** Pricing unit DIAL Core assumes when a deployment names none. */
const DEFAULT_PRICING_UNIT = 'token';
const UNITS_PER_QUOTED_PRICE = 1_000_000;

/*
 * DIAL Core's countable billing units, which are re-quoted per 1M units,
 * mapped to the plural shown after `/M`.
 */
const PER_MILLION_UNIT_LABELS: Record<string, string> = {
  token: 'tokens',
  char_without_whitespace: 'chars without whitespace',
};

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

/*
 * Sub-dollar amounts keep significant digits rather than a fixed number of
 * decimals, so a non-zero price is never rounded to `$0` or off by a digit.
 */
const smallPriceFormatter = new Intl.NumberFormat(PRICE_LOCALE, {
  style: 'currency',
  currency: 'USD',
  maximumSignificantDigits: 6,
});

/** Formats an accumulated USD cost with at most two decimals (for example, `$0.79`). */
export const formatCost = (value: number): string =>
  priceFormatter.format(value);

/** Formats an amount as USD, keeping up to six significant digits for sub-dollar values (e.g. `$3`, `$0.3`, `$0.00000015`). */
export const formatPrice = (value: number): string => {
  if (value !== 0 && Math.abs(value) < 1) {
    return smallPriceFormatter.format(value);
  }
  return formatCost(value);
};

/*
 * DIAL Core quotes prices per single unit (for example `'0.000003'` per token),
 * which is unreadable in a table, so token and character prices are re-quoted
 * per 1M units (`$3/M tokens`, `$0.15/M chars without whitespace`) — the
 * convention model-pricing pages use. Any other unit keeps its per-unit price
 * and names the unit. A missing unit is treated as tokens, DIAL Core's default.
 */
/** Formats a per-unit price string for display, e.g. `$3/M tokens` or `$0.15/M chars without whitespace`. */
export const formatUnitPrice = (
  price: string | undefined,
  unit: string | undefined,
): string | undefined => {
  if (price == null) return undefined;

  const perUnit = Number(price);
  if (price.trim() === '' || !Number.isFinite(perUnit)) return price;

  const unitKey = (unit ?? DEFAULT_PRICING_UNIT).toLowerCase();
  const perMillionLabel = PER_MILLION_UNIT_LABELS[unitKey];
  if (perMillionLabel != null) {
    return `${formatPrice(perUnit * UNITS_PER_QUOTED_PRICE)}/M ${perMillionLabel}`;
  }

  return `${formatPrice(perUnit)}/${unitKey.replace(/_/g, ' ')}`;
};
