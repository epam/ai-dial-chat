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
      className="bg-pr-primary-550 max-h-[165px] w-[320px] rounded-primary text-xs text-[#BAD9FF]"
    >
      <div className="flex items-center justify-between p-[10px_15px_0]">
        <div>{step.title}</div>
        <button onClick={closeProps.onClick}>
          <CloseIcon />
        </button>
      </div>

      <div className="text-pr-grey-white p-4">{step.content}</div>
      <div className="flex h-[39px] w-full items-center justify-between rounded-b-md bg-gradient-to-r from-layer-8 to-layer-9 px-4 text-pr-primary-700">
        {index > 1 ? (
          <button
            className="button button-primary button-small"
            id={TooltipId.back}
            {...backProps}
          >
            <ArrowLeftIcon width={3.5} height={6} />
            <div>{t('Back')} </div>
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
            className="button button-primary button-small"
          >
            <div> {t('Next')} </div>
            <ArrowRightIcon width={3.5} height={6} />
          </button>
        )}
      </div>
    </div>
  );
};

export { Tooltip };
