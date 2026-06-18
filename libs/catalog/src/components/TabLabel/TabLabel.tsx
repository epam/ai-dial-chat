import { FC } from 'react';

/** Props for TabLabel. */
export interface TabLabelProps {
  /** Tab display text. */
  text: string;
  /** Item count shown as a secondary number next to the text. */
  count: number;
  /** CSS class for the count. Default: 'dial-tiny-text text-secondary'. */
  countClassName?: string;
}

/** Tab content with an inline secondary count number (no DialTag wrapper). */
export const TabLabel: FC<TabLabelProps> = ({
  text,
  count,
  countClassName = 'dial-tiny-text text-secondary',
}) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span>{text}</span>
    <span className={countClassName}>{count}</span>
  </span>
);
