import { IconHelp } from '@tabler/icons-react';
import { ReactNode } from 'react';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props {
  labelDataQa: string;
  label: string;
  valueDataQa: string;
  valueToDisplay: ReactNode;
  tooltip?: ReactNode;
  infoTooltip?: string;
}
export function PublicationInfoSection({
  labelDataQa,
  label,
  valueDataQa,
  valueToDisplay,
  tooltip,
  infoTooltip,
}: Props) {
  return (
    <section className="mb-3">
      <h3
        className="flex flex-row gap-1 text-xs text-secondary"
        data-qa={labelDataQa}
      >
        {label}
        {infoTooltip && (
          <Tooltip
            tooltip={infoTooltip}
            triggerClassName="flex shrink-0 text-secondary hover:text-accent-primary"
            contentClassName="max-w-[220px]"
            placement="top"
          >
            <IconHelp size={18} />
          </Tooltip>
        )}
      </h3>

      {tooltip ? (
        <Tooltip
          contentClassName="max-w-[400px] break-all my-1 text-sm"
          triggerClassName="truncate whitespace-pre"
          tooltip={<div className="flex break-words">{tooltip}</div>}
          dataQa={valueDataQa}
        >
          <span className="w-full">{valueToDisplay}</span>
        </Tooltip>
      ) : (
        <span className="w-full" data-qa={valueDataQa}>
          {valueToDisplay}
        </span>
      )}
    </section>
  );
}
