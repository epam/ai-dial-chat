import {
  CSSProperties,
  ReactNode,
  UIEvent,
  forwardRef,
  useImperativeHandle,
  useRef,
} from 'react';

import classNames from 'classnames';

import { useOverlayScrollbar } from '@/src/hooks/useOverlayScrollbar';

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  deps?: unknown[];
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
}

export const OverlayScrollArea = forwardRef<HTMLDivElement, Props>(
  ({ children, className, style, deps = [], onScroll }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement);

    const {
      vertical,
      horizontal,
      active,
      onScroll: onOverlayScroll,
      onMouseEnter,
    } = useOverlayScrollbar(scrollRef, deps);

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
      onOverlayScroll();
      onScroll?.(event);
    };

    return (
      <div className="group/scroll relative" onMouseEnter={onMouseEnter}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={classNames('no-scrollbar', className)}
          style={style}
        >
          {children}
        </div>
        {vertical.visible && (
          <div
            className={classNames(
              'pointer-events-none absolute right-0.5 top-0 w-1.5 rounded-full bg-controls-disable transition-opacity duration-300',
              active
                ? 'opacity-100'
                : 'opacity-0 group-hover/scroll:opacity-60',
            )}
            style={{
              height: vertical.size,
              transform: `translateY(${vertical.offset}px)`,
            }}
          />
        )}
        {horizontal.visible && (
          <div
            className={classNames(
              'pointer-events-none absolute bottom-0.5 left-0 h-1.5 rounded-full bg-controls-disable transition-opacity duration-300',
              active
                ? 'opacity-100'
                : 'opacity-0 group-hover/scroll:opacity-60',
            )}
            style={{
              width: horizontal.size,
              transform: `translateX(${horizontal.offset}px)`,
            }}
          />
        )}
      </div>
    );
  },
);

OverlayScrollArea.displayName = 'OverlayScrollArea';
