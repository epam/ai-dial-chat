import { ReactNode } from 'react';

import Tooltip from '../Common/Tooltip';

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
        <Tooltip tooltip={tooltipContent} triggerClassName="flex shrink-0">
          {icon}
        </Tooltip>
      )}
    </>
  );
};
