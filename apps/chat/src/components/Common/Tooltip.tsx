import type { Placement } from '@floating-ui/react';
import {
  FloatingArrow,
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  hide,
  offset,
  safePolygon,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react';
import {
  HTMLProps,
  ReactElement,
  ReactNode,
  Ref,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

interface TooltipContainerOptions {
  initialOpen?: boolean;
  placement?: Placement;
  isTriggerClickable?: boolean;
  isHoverDisabled?: boolean;
  interactive?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function useTooltip({
  initialOpen = false,
  placement = 'bottom',
  isTriggerClickable = false,
  isHoverDisabled = false,
  interactive = false,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: TooltipContainerOptions = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(initialOpen);
  const arrowRef = useRef<SVGSVGElement>(null);

  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = setControlledOpen ?? setUncontrolledOpen;

  const ARROW_HEIGHT = 7;
  const GAP = 2;

  const data = useFloating({
    placement,
    open,
    onOpenChange: setOpen,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(ARROW_HEIGHT + GAP),
      flip({
        crossAxis: placement.includes('-'),
        fallbackAxisSideDirection: 'start',
        padding: 5,
      }),
      shift({ padding: 5 }),
      arrow({
        element: arrowRef,
      }),
      hide(),
    ],
  });

  const context = data.context;

  const uncontrolled = controlledOpen == null;

  const hover = useHover(context, {
    move: false,
    enabled: uncontrolled && !isHoverDisabled,
    mouseOnly: isTriggerClickable,
    delay: {
      open: 500,
      close: interactive ? 150 : 0,
    },
    handleClose: interactive ? safePolygon() : null,
  });

  const focus = useFocus(context, {
    enabled: uncontrolled && !isHoverDisabled && !isTriggerClickable,
  });

  const click = useClick(context, {
    enabled: uncontrolled && isHoverDisabled,
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const interactions = useInteractions([hover, focus, click, dismiss, role]);

  return useMemo(
    () => ({
      open,
      setOpen,
      arrowRef,
      ...interactions,
      ...data,
    }),
    [open, setOpen, interactions, data],
  );
}

type ContextType = ReturnType<typeof useTooltip> | null;

const TooltipContext = createContext<ContextType>(null);

const useTooltipContext = () => {
  const context = useContext(TooltipContext);

  if (context == null) {
    throw new Error('Tooltip components must be wrapped in <Tooltip />');
  }

  return context;
};

function TooltipContainer({
  children,
  ...options
}: { children: ReactNode } & TooltipContainerOptions) {
  // This can accept any props as options, e.g. `placement`,
  // or other positioning options.
  const tooltip = useTooltip(options);
  return (
    <TooltipContext.Provider value={tooltip}>
      {children}
    </TooltipContext.Provider>
  );
}

const TooltipTrigger = forwardRef<
  HTMLElement,
  HTMLProps<HTMLElement> & { asChild?: boolean }
>(function TooltipTrigger({ children, asChild = false, ...props }, propRef) {
  const context = useTooltipContext();

  // In React 19, ref is now a regular prop, so we check children.props.ref
  const isRefInChildren =
    children &&
    isValidElement(children) &&
    children.props &&
    typeof children.props === 'object' &&
    'ref' in children.props &&
    children.props.ref !== undefined &&
    children.props.ref !== null;
  const childrenRef = isRefInChildren
    ? (children as ReactElement<{ ref: Ref<unknown> }>).props.ref
    : undefined;
  const ref = useMergeRefs([context.refs.setReference, propRef, childrenRef]);

  // `asChild` allows the user to pass any element as the anchor
  if (asChild && isValidElement(children)) {
    return cloneElement(
      children,
      context.getReferenceProps({
        ref,
        ...props,
        ...(typeof children.props === 'object' &&
          children.props !== null &&
          children.props),
        'data-state': context.open ? 'open' : 'closed',
      } as HTMLProps<HTMLElement>),
    );
  }

  return (
    <span
      ref={ref}
      // The user can style the trigger based on the state
      data-state={context.open ? 'open' : 'closed'}
      {...context.getReferenceProps(props)}
      className={props.className || 'flex h-full items-center justify-center'}
    >
      {children}
    </span>
  );
});

const TooltipContent = forwardRef<HTMLDivElement, HTMLProps<HTMLDivElement>>(
  function TooltipContent({ style, ...props }, propRef) {
    const context = useTooltipContext();
    const ref = useMergeRefs([context.refs.setFloating, propRef]);

    if (!context.open) return null;

    const isReferenceHidden = context.middlewareData.hide?.referenceHidden;

    return (
      <FloatingPortal id="theme-main">
        <div
          ref={ref}
          style={{
            ...context.floatingStyles,
            visibility: isReferenceHidden ? 'hidden' : 'visible',
            ...style,
          }}
          {...context.getFloatingProps(props)}
          className={classNames(
            '!z-[10000] whitespace-pre-wrap rounded border border-primary bg-layer-0 px-2 py-1 text-start shadow',
            context.getFloatingProps(props).className as string,
          )}
          data-qa="tooltip"
        >
          {props.children}
          <FloatingArrow
            ref={context.arrowRef}
            context={context.context}
            fill="currentColor"
            strokeWidth={1}
            className="stroke-primary text-[var(--bg-layer-0,_#000000)]"
          />
        </div>
      </FloatingPortal>
    );
  },
);

export interface TooltipOptions extends TooltipContainerOptions {
  hideTooltip?: boolean;
  tooltip: ReactNode;
  children: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  dataQa?: string;
  asChild?: boolean;
}

export function Tooltip({
  hideTooltip,
  tooltip,
  children,
  triggerClassName,
  contentClassName,
  dataQa,
  asChild,
  ...tooltipProps
}: TooltipOptions) {
  if (hideTooltip || !tooltip)
    return (
      <span className={triggerClassName} data-qa={dataQa} data-state="closed">
        {children}
      </span>
    );
  return (
    <TooltipContainer {...tooltipProps}>
      <TooltipTrigger
        className={triggerClassName}
        data-qa={dataQa}
        asChild={asChild}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        className={classNames(
          '!z-[10000] max-w-[250px] break-words sm:max-w-[400px]',
          contentClassName,
        )}
      >
        {tooltip}
      </TooltipContent>
    </TooltipContainer>
  );
}
