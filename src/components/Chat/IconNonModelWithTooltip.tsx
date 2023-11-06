import { ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '../Common/Tooltip';

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
  return (
    <>
      {isCustomTooltip ? (
        { icon }
      ) : (
        <Tooltip>
          <TooltipTrigger className="flex shrink-0">{icon}</TooltipTrigger>
          <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
};
