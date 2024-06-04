import React, { FC } from 'react';
import { TooltipRenderProps } from 'react-joyride';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { TooltipId } from '@/src/components/TourGuide/TourGuide.props';

import { CloseIcon, LogoIcon } from '@/src/icons';

const WelcomeTooltip: FC<TooltipRenderProps> = ({
  step,
  closeProps,
  primaryProps,
  tooltipProps,
}) => {
  const { t } = useTranslation(Translation.TourGuide);

  return (
    <div
      {...tooltipProps}
      className="flex h-[380px] w-[500px] flex-col items-center rounded-md bg-gradient-to-bl from-[#709bcd] to-[#fef2b6] p-[15px] text-center text-sm text-[#000A32]"
    >
      <div className="flex w-full justify-end">
        <button onClick={closeProps.onClick}>
          <CloseIcon color="#023465" />
        </button>
      </div>

      <div className="my-[30px] flex items-center justify-center">
        <LogoIcon />
        <div className="font-weave ml-[10px] text-[30px] font-bold text-[#000A32]">
          PR GPT
        </div>
      </div>

      <div className="px-[40px] text-[18px] font-medium leading-6">
        {step.title}
      </div>

      <div className="px-[18px] py-[15px] text-[13px] leading-5">
        {step.content}
      </div>

      <button
        id={TooltipId.next}
        {...primaryProps}
        className="text-primary-bg-dark my-[10px] mt-[27px] block rounded-[40px] bg-layer-3 px-[16px] py-[6px]"
      >
        {t('Start a quick tour')}
      </button>

      <button
        id={TooltipId.close}
        onClick={closeProps.onClick}
        className="text-pr-primary-700 block"
      >
        {t('Skip the tour')}
      </button>
    </div>
  );
};

export { WelcomeTooltip };
