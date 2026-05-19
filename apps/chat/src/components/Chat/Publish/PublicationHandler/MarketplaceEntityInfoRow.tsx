import { ReactNode } from 'react';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface InfoRowProps {
  label: string;
  value: ReactNode;
  dataQa?: string;
  valueClassName?: string;
  labelClassName?: string;
  wrapperClassName?: string;
  noTooltip?: boolean;
}

export function MarketplaceEntityInfoRow({
  label,
  value,
  dataQa,
  valueClassName = 'text-primary',
  labelClassName = 'text-secondary shrink-0 self-start',
  wrapperClassName = 'contents',
  noTooltip = false,
}: InfoRowProps) {
  if (value == null || value === '') return null;

  return (
    <div className={wrapperClassName}>
      <span
        className={labelClassName}
        data-qa={dataQa ? `${dataQa}-label` : undefined}
      >{`${label}:`}</span>

      <div data-qa={dataQa} className="min-w-0 flex-1">
        {!noTooltip ? (
          <DialEllipsisTooltip text={value} className={valueClassName} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}
