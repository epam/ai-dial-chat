import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  Tooltip,
  TooltipPlacement,
} from '@epam/ai-dial-ui-kit';
import { IconArrowsHorizontal } from '@tabler/icons-react';
import {
  FC,
  KeyboardEvent,
  PointerEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  clampLeftColumnWidth,
  LEFT_COLUMN_KEY_STEP,
} from '../../utils/clamp-left-column-width';
import styles from './EditorLayout.module.scss';

const TOOLTIP_DELAY_MS = 1000;
const REST_TOLERANCE_PX = 4;

interface ResizeHandleProps {
  /** Current (already clamped) width of the left column in px. */
  width: number;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  /** Body container, used to keep the center column's minimum width and to read the direction. */
  containerRef: RefObject<HTMLElement | null>;
  onWidthChange: (width: number) => void;
  label: string;
  tooltip: string;
}

const isRtl = (element: HTMLElement | null): boolean => {
  if (element == null) {
    return false;
  }
  const direction =
    element.closest('[dir]')?.getAttribute('dir') ??
    getComputedStyle(element).direction;

  return direction === 'rtl';
};

/** Vertical separator on the inline-end edge of the left column that resizes it by pointer or keyboard. */
export const ResizeHandle: FC<ResizeHandleProps> = ({
  width,
  minWidth,
  maxWidth,
  defaultWidth,
  containerRef,
  onWidthChange,
  label,
  tooltip,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHoverReady, setIsHoverReady] = useState(false);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const restPoint = useRef({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const frame = useRef<number>(undefined);

  useEffect(
    () => () => {
      clearTimeout(hoverTimer.current);
      if (frame.current != null) {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  const clamp = useCallback(
    (value: number) =>
      clampLeftColumnWidth(value, {
        min: minWidth,
        max: maxWidth,
        containerWidth: containerRef.current?.clientWidth,
      }),
    [containerRef, maxWidth, minWidth],
  );

  /* The arrow replaces the native cursor only once it sits under the pointer, so no frame has neither. */
  const moveCursor = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.dataset.cursorReady = '';
    cursorRef.current?.style.setProperty(
      'transform',
      `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`,
    );
  };

  /* The line and tooltip appear once the pointer has rested, so they restart whenever it moves away. */
  const startRestTimer = (event: PointerEvent<HTMLDivElement>) => {
    restPoint.current = { x: event.clientX, y: event.clientY };
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(
      () => setIsHoverReady(true),
      TOOLTIP_DELAY_MS,
    );
  };

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    moveCursor(event);
    startRestTimer(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.cursorReady;
    clearTimeout(hoverTimer.current);
    setIsHoverReady(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, width };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    moveCursor(event);
    const start = dragStart.current;
    if (start == null) {
      const moved =
        Math.hypot(
          event.clientX - restPoint.current.x,
          event.clientY - restPoint.current.y,
        ) > REST_TOLERANCE_PX;
      if (moved) {
        setIsHoverReady(false);
        startRestTimer(event);
      }
      return;
    }
    const direction = isRtl(containerRef.current) ? -1 : 1;
    const next = clamp(start.width + (event.clientX - start.x) * direction);
    if (frame.current != null) {
      cancelAnimationFrame(frame.current);
    }
    frame.current = requestAnimationFrame(() => onWidthChange(next));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragStart.current == null) {
      return;
    }
    dragStart.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = isRtl(containerRef.current) ? -1 : 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = width + LEFT_COLUMN_KEY_STEP * direction;
        break;
      case 'ArrowLeft':
        next = width - LEFT_COLUMN_KEY_STEP * direction;
        break;
      case 'Home':
        next = minWidth;
        break;
      case 'End':
        next = maxWidth;
        break;
      default:
        return;
    }
    event.preventDefault();
    onWidthChange(clamp(next));
  };

  return (
    <>
      {/* A focusable separator is the ARIA window-splitter widget, so it is interactive. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={width}
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        tabIndex={0}
        className={mergeClasses(
          'absolute inset-y-0 -me-1 hidden w-2 touch-none select-none desktop:block',
          'end-0',
          styles.resizeHandle,
          isHoverReady && styles.resizeHandleHover,
          isDragging && styles.resizeHandleDragging,
        )}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => onWidthChange(clamp(defaultWidth))}
      >
        {/* Drawn instead of a CSS cursor image, which cannot read theme tokens. */}
        <Tooltip
          tooltip={tooltip}
          open={isHoverReady && !isDragging}
          placement={
            isRtl(containerRef.current)
              ? TooltipPlacement.Left
              : TooltipPlacement.Right
          }
          asChild
        >
          <span
            ref={cursorRef}
            aria-hidden
            className={mergeClasses(
              'z-tooltip pointer-events-none fixed start-0 top-0 hidden text-secondary',
              styles.resizeCursor,
            )}
          >
            <IconArrowsHorizontal size={24} stroke={DIAL_KIT_ICON_STROKE} />
          </span>
        </Tooltip>
      </div>
    </>
  );
};
