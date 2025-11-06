import { ReactNode } from 'react';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface Props {
  icon: ReactNode;
  isCustomTooltip?: boolean;
  tooltipContent: ReactNode;
}

export const IconNonModelWithTooltip = ({
  icon,
  isCustomTooltip,
  tooltipContent,
}: Props) => {
  if (isCustomTooltip) {
    return icon;
  }

  return (
    <Tooltip tooltip={tooltipContent} triggerClassName="flex shrink-0">
      {icon}
    </Tooltip>
  );
};
