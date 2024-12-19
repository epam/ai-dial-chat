import type { Placement } from '@floating-ui/react';
import {
  FloatingArrow,
  FloatingPortal,
  arrow,
  autoUpdate,
  flip,
  offset,
  shift,
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useTooltip({
  initialOpen = false,
  placement = 'bottom',
  isTriggerClickable = false,
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
    ],
  });

  const context = data.context;

  const hover = useHover(context, {
    move: false,
    enabled: controlledOpen == null,
    mouseOnly: isTriggerClickable,
    delay: {
      open: 500,
      close: 0,
    },
  });
  const focus = useFocus(context, {
    enabled: controlledOpen == null,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'tooltip' });

  const interactions = useInteractions([hover, focus, dismiss, role]);

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

export const useTooltipContext = () => {
  const context = useContext(TooltipContext);

  if (context == null) {
    throw new Error('Tooltip components must be wrapped in <Tooltip />');
  }

  return context;
};

export function TooltipContainer({
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

export const TooltipTrigger = forwardRef<
  HTMLElement,
  HTMLProps<HTMLElement> & { asChild?: boolean }
>(function TooltipTrigger({ children, asChild = false, ...props }, propRef) {
  const context = useTooltipContext();

  const typedChildren = children as ReactNode;

  const isRefInChildren =
    typedChildren &&
    typeof typedChildren === 'object' &&
    'ref' in typedChildren &&
    typedChildren.ref !== undefined;

  const childrenRef = isRefInChildren
    ? (typedChildren.ref as Ref<unknown>)
    : undefined;
  const ref = useMergeRefs([context.refs.setReference, propRef, childrenRef]);

  // `asChild` allows the user to pass any element as the anchor
  if (asChild && isValidElement(children)) {
    return cloneElement(
      children,
      context.getReferenceProps({
        ref,
        ...props,
        ...children.props,
        'data-state': context.open ? 'open' : 'closed',
      }),
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

export const TooltipContent = forwardRef<
  HTMLDivElement,
  HTMLProps<HTMLDivElement>
>(function TooltipContent({ style, ...props }, propRef) {
  const context = useTooltipContext();
  const ref = useMergeRefs([context.refs.setFloating, propRef]);

  if (!context.open) return null;

  return (
    <FloatingPortal id="theme-main">
      <div
        ref={ref}
        style={{
          ...context.floatingStyles,
          ...style,
        }}
        {...context.getFloatingProps(props)}
        className={classNames(
          'z-50 whitespace-pre-wrap rounded border border-primary bg-layer-0 px-2 py-1 text-left shadow',
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
});

interface TooltipOptions extends TooltipContainerOptions {
  hideTooltip?: boolean;
  tooltip: ReactNode;
  children: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  dataQa?: string;
}

export default function Tooltip({
  hideTooltip,
  tooltip,
  children,
  triggerClassName,
  contentClassName,
  dataQa,
  ...tooltipProps
}: TooltipOptions) {
  if (hideTooltip || !tooltip)
    return (
      <span className={triggerClassName} data-qa={dataQa}>
        {children}
      </span>
    );
  return (
    <TooltipContainer {...tooltipProps}>
      <TooltipTrigger className={triggerClassName} data-qa={dataQa}>
        {children}
      </TooltipTrigger>
      <TooltipContent className={contentClassName}>{tooltip}</TooltipContent>
    </TooltipContainer>
  );
}
