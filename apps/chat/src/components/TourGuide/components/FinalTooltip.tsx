import React, { FC } from 'react';
import { TooltipRenderProps } from 'react-joyride';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { TooltipId } from '@/src/components/TourGuide/TourGuide.props';

import { CloseIcon } from '@/src/icons';

const FinalTooltip: FC<TooltipRenderProps> = ({
  step,
  closeProps,
  primaryProps,
  tooltipProps,
}) => {
  const { t } = useTranslation(Translation.TourGuide);

  return (
    <div
      {...tooltipProps}
      className="flex h-[220px] w-[500px] flex-col items-center rounded-md bg-gradient-to-bl from-[#709bcd] to-[#fef2b6] p-[15px] text-center text-sm text-[#000A32]"
    >
      <div className="flex w-full justify-end">
        <button onClick={closeProps.onClick}>
          <CloseIcon color="#023465" />
        </button>
      </div>

      <div className="mt-[25px] px-[40px] text-[18px] font-medium leading-6">
        {step.title}
      </div>

      <button
        id={TooltipId.next}
        {...primaryProps}
        className="mt-[48px] block rounded-[40px] bg-[#023465] px-[16px] py-[6px] text-[#fff]"
      >
        {t('Start using PR GPT')}
      </button>
    </div>
  );
};

export { FinalTooltip };
