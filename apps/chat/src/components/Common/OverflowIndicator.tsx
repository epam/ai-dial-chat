import React, { useCallback, useRef, useState } from 'react';

import classNames from 'classnames';

import { stopBubbling } from '@/src/constants/chat';

import { ShrinkWrappedTooltipContent } from '@/src/components/Common/ShrinkWrappedTooltipContent';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { DialLinkButton, ElementSize } from '@epam/ai-dial-ui-kit';

const TOOLTIP_MAX_WIDTH = 198;

interface OverflowIndicatorProps {
  count: number;
  tooltipContent: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  displayDelay?: number;
  className?: string;
  dataQA?: string;
}

export const OverflowIndicator = ({
  count,
  tooltipContent,
  placement = 'top',
  displayDelay = 100,
  className,
  dataQA = 'hidden-topics',
}: OverflowIndicatorProps) => {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDelayShow = useCallback(
    (show: boolean) => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setOpen(show), displayDelay);
    },
    [displayDelay],
  );

  return (
    <Tooltip
      tooltip={
        <ShrinkWrappedTooltipContent
          maxWidth={TOOLTIP_MAX_WIDTH}
          onClick={stopBubbling}
        >
          {tooltipContent}
        </ShrinkWrappedTooltipContent>
      }
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      triggerClassName="inline-flex self-start"
      isTriggerClickable
      isHoverDisabled
    >
      <DialLinkButton
        className={classNames(
          'min-w-0 border-accent-primary px-1.5 py-1',
          className,
        )}
        textClassName="leading-3"
        size={ElementSize.Small}
        onClick={(event) => {
          stopBubbling(event);
          handleDelayShow(!open);
        }}
        data-qa={dataQA}
        label={`+${count}`}
      />
    </Tooltip>
  );
};
