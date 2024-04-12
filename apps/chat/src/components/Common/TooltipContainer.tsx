import { IconHelp } from '@tabler/icons-react';
import React, { FC } from 'react';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import Tooltip from '@/src/components/Common/Tooltip';

interface TooltipContainerProps {
  description: string;
}

const TooltipContainer: FC<TooltipContainerProps> = ({ description }) => (
  <Tooltip
    contentClassName="max-w-[220px]"
    triggerClassName="text-secondary cursor-pointer"
    tooltip={
      <EntityMarkdownDescription>{description}</EntityMarkdownDescription>
    }
  >
    <IconHelp size={18} />
  </Tooltip>
);

export { TooltipContainer };
