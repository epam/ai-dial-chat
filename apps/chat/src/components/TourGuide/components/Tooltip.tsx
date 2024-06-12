import React, { FC } from 'react';
import { TooltipRenderProps } from 'react-joyride';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

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
}) => {
  const { t } = useTranslation(Translation.TourGuide);

  return (
    <div
      {...tooltipProps}
      //With the new theme design, styles will be updated with theme variables
      className="h-[165px] w-[320px] rounded-md bg-layer-3 text-xs text-[#BAD9FF]"
    >
      <div className="flex items-center justify-between p-[10px_15px_0]">
        <div>{step.title}</div>
        <button onClick={closeProps.onClick}>
          <CloseIcon />
        </button>
      </div>

      <div className="p-4">{step.content}</div>
      <div className="relative bottom-[-16px] flex h-[35px] w-[320px] items-center justify-between rounded-b-md bg-gradient-to-r from-layer-8 to-layer-9 px-4 text-pr-primary-700">
        {index > 1 ? (
          <button
            className="flex h-[25px] w-[55px] items-center justify-center rounded-full bg-layer-3 text-primary-bg-dark"
            id={TooltipId.back}
            {...backProps}
          >
            <ArrowLeftIcon />
            <div className="ml-[5px]">{t('Back')} </div>
          </button>
        ) : (
          <button id={TooltipId.close} {...closeProps}>
            {t('Skip Tour')}
          </button>
        )}
        <div>{`Step ${index}/${size - 2}`}</div>

        {continuous && (
          <button
            id={TooltipId.next}
            {...primaryProps}
            className="flex h-[25px] w-[55px] items-center justify-center rounded-full bg-layer-3 text-primary-bg-dark"
          >
            <div className="mr-[5px]"> {t('Next')} </div>
            <ArrowRightIcon />
          </button>
        )}
      </div>
    </div>
  );
};

export { Tooltip };
