import { MouseEventHandler, ReactNode, useRef } from 'react';

interface TooltipProps {
  children: ReactNode;
  tooltip: ReactNode;
}

export const Tooltip = ({ children, tooltip }: TooltipProps) => {
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseEnterHandler: MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (!tooltipRef.current || !containerRef.current) return;
    const { left } = containerRef.current.getBoundingClientRect();
    tooltipRef.current.style.left = `${e.clientX - left}px`;
  };
  return (
    <div
      ref={containerRef}
      className="group relative inline-block"
      onMouseEnter={onMouseEnterHandler}
    >
      {children}
      <span
        ref={tooltipRef}
        className="text-xs text-neutral-200 invisible group-hover:visible group-hover:opacity-100 transition opacity-0  absolute rounded bg-[#202123]/70 bottom-full whitespace-nowrap p-1"
      >
        {tooltip}
      </span>
    </div>
  );
};
