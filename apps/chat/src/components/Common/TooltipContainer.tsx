import React, { FC } from 'react';

import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';
import Tooltip from '@/src/components/Common/Tooltip';

import HelpIcon from '../../../public/images/icons/help.svg';

interface TooltipContainerProps {
  description: string;
}

const TooltipContainer: FC<TooltipContainerProps> = ({ description }) => (
  <Tooltip
    contentClassName="max-w-[220px]"
    triggerClassName="text-secondary-bg-dark cursor-pointer"
    tooltip={
      <EntityMarkdownDescription>{description}</EntityMarkdownDescription>
    }
  >
    <HelpIcon width={18} height={18} />
  </Tooltip>
);

export { TooltipContainer };
