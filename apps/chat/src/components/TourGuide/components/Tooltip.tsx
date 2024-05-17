import React, { FC } from 'react';
import { TooltipRenderProps } from 'react-joyride';

import { TooltipId } from '@/src/components/TourGuide/TourGuide.props';

import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from '@/src/icons';

const Tooltip: FC<TooltipRenderProps> = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  size,
}) => (
  <div
    {...tooltipProps}
    //With the new theme design, styles will be updated with theme variables
    className="h-[150px] w-[320px] rounded-md bg-[#023465] text-xs text-[#BAD9FF]"
  >
    <div className="flex items-center justify-between p-[10px_15px_0]">
      <div>{step.title}</div>
      <button onClick={closeProps.onClick}>
        <CloseIcon />
      </button>
    </div>

    <div className="p-4">{step.content}</div>
    <div className="relative bottom-[-9px] flex h-[35px] w-[320px] items-center justify-between rounded-b-md bg-gradient-to-r from-[#C0DDF2] to-[#F3E8CE] px-4 text-[#023465]">
      {index > 1 ? (
        <button
          className="flex h-[25px] w-[55px] items-center justify-center rounded-full bg-[#023465] text-[#fff]"
          id={TooltipId.back}
          {...backProps}
        >
          <ArrowLeftIcon />
          <div className="ml-[5px]">Back</div>
        </button>
      ) : (
        <button id={TooltipId.close} {...closeProps}>
          Skip Tour
        </button>
      )}
      <div>{`Step ${index}/${size - 2}`}</div>

      {continuous && (
        <button
          id={TooltipId.next}
          {...primaryProps}
          className="flex h-[25px] w-[55px] items-center justify-center rounded-full bg-[#023465] text-[#fff]"
        >
          <div className="mr-[5px]">Next</div>
          <ArrowRightIcon />
        </button>
      )}
    </div>
  </div>
);

export { Tooltip };
