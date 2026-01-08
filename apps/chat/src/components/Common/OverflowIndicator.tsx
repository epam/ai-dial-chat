import React, { useCallback, useRef, useState } from 'react';

import classNames from 'classnames';

import { stopBubbling } from '@/src/constants/chat';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { DialButton } from '@epam/ai-dial-ui-kit';

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
        <div
          className="my-1 flex max-w-[198px] flex-wrap gap-2"
          onClick={stopBubbling}
        >
          {tooltipContent}
        </div>
      }
      open={open}
      onOpenChange={setOpen}
      placement={placement}
    >
      <DialButton
        className={classNames(
          'flex items-center rounded border border-accent-primary bg-transparent p-0 px-1.5 py-1',
          className,
        )}
        textClassName="font-normal leading-3 text-xs"
        onClick={(event) => {
          stopBubbling(event);
          handleDelayShow(!open);
        }}
        onMouseEnter={() => handleDelayShow(true)}
        onMouseLeave={() => handleDelayShow(false)}
        data-qa={dataQA}
        label={`+${count}`}
      />
    </Tooltip>
  );
};
