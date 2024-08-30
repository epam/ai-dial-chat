import {
  FloatingFocusManager,
  FloatingList,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  Placement,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFloatingTree,
  useHover,
  useInteractions,
  useListItem,
  useListNavigation,
  useMergeRefs,
  useRole,
  useTypeahead,
} from '@floating-ui/react';
import {
  ButtonHTMLAttributes,
  Dispatch,
  FocusEvent,
  HTMLProps,
  MouseEvent,
  ReactNode,
  SetStateAction,
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { hasParentWithAttribute } from '@/src/utils/app/modals';

const menuItemClassNames = classNames(
  'flex max-w-[300px] cursor-pointer items-center gap-3 focus-visible:outline-none',
);

const MenuContext = createContext<{
  getItemProps: (userProps?: HTMLProps<HTMLElement>) => Record<string, unknown>;
  activeIndex: number | null;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  setHasFocusInside: Dispatch<SetStateAction<boolean>>;
  isOpen: boolean | undefined;
}>({
  getItemProps: () => ({}),
  activeIndex: null,
  setActiveIndex: () => ({}),
  setHasFocusInside: () => ({}),
  isOpen: false,
});

interface MenuProps {
  listClassName?: string;
  trigger?: ReactNode;
  nested?: boolean;
  children?: ReactNode;
  type?: 'dropdown' | 'contextMenu';
  isMenuOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  placement?: Placement;
  shouldFlip?: boolean;
  shouldApplySize?: boolean;
  enableAncestorScroll?: boolean;
  noFocusReturn?: boolean;
  isTriggerEnabled?: boolean;
}

export const MenuComponent = forwardRef<
  HTMLDivElement,
  MenuProps & HTMLProps<HTMLButtonElement>
>(function MenuComponent(
  {
    children,
    style,
    className,
    listClassName,
    label,
    trigger,
    type = 'dropdown',
    placement,
    isMenuOpen,
    onOpenChange,
    shouldFlip = true,
    shouldApplySize = true,
    noFocusReturn = false,
    enableAncestorScroll = false,
    isTriggerEnabled = true,
    ...props
  },
  forwardedRef,
) {
  const [isOpen, setIsOpen] = useState(isMenuOpen);
  const [hasFocusInside, setHasFocusInside] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [floatingWidth, setFloatingWidth] = useState(0);

  const elementsRef = useRef<HTMLButtonElement[]>([]);
  const labelsRef = useRef<string[]>([]);
  const parent = useContext(MenuContext);

  const tree = useFloatingTree();
  const nodeId = useFloatingNodeId();
  const parentId = useFloatingParentNodeId();
  const item = useListItem();

  const isNested = parentId != null;

  useEffect(() => {
    setIsOpen(isMenuOpen);
  }, [isMenuOpen]);

  const { floatingStyles, refs, context } = useFloating<HTMLButtonElement>({
    nodeId,
    open: isOpen,
    onOpenChange: (isOpened) => {
      if (
        hasParentWithAttribute(
          context.dataRef.current.openEvent?.target as Element | null,
          'data-no-context-menu',
        )
      ) {
        return;
      }

      setIsOpen(isOpened);
      onOpenChange?.(isOpened);
    },
    placement: placement ?? (isNested ? 'right-start' : 'bottom-start'),
    middleware: [
      offset(0),
      ...(shouldFlip ? [flip()] : []),
      shift(),
      ...(shouldApplySize
        ? [
            size({
              apply({ rects, availableWidth, availableHeight, elements }) {
                setFloatingWidth(rects.reference.width);
                Object.assign(elements.floating.style, {
                  maxWidth: `${availableWidth}px`,
                  maxHeight: `${availableHeight}px`,
                });
              },
            }),
          ]
        : []),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    enabled: isNested,
    delay: { open: 75 },
    handleClose: safePolygon({
      blockPointerEvents: true,
      buffer: -Infinity,
      requireIntent: false,
    }),
  });
  const click = useClick(context, {
    event: 'mousedown',
    toggle: !isNested,
    enabled: isTriggerEnabled,
    ignoreMouse: isNested,
  });
  const role = useRole(context, { role: 'menu' });
  const dismiss = useDismiss(context, {
    bubbles: true,
    ancestorScroll: enableAncestorScroll,
  });
  const listNavigation = useListNavigation(context, {
    listRef: elementsRef,
    activeIndex,
    nested: isNested,
    onNavigate: setActiveIndex,
  });
  const typeahead = useTypeahead(context, {
    listRef: labelsRef,
    onMatch: isOpen ? setActiveIndex : undefined,
    activeIndex,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [hover, click, role, dismiss, listNavigation, typeahead],
  );

  // Event emitter allows you to communicate across tree components.
  // This effect closes all menus when an item gets clicked anywhere
  // in the tree.
  useEffect(() => {
    if (!tree) return;

    function handleTreeClick() {
      setIsOpen(false);
    }

    function onSubMenuOpen(event: { nodeId: string; parentId: string }) {
      if (event.nodeId !== nodeId && event.parentId === parentId) {
        setIsOpen(false);
      }
    }

    tree.events.on('click', handleTreeClick);
    tree.events.on('menuopen', onSubMenuOpen);

    return () => {
      tree.events.off('click', handleTreeClick);
      tree.events.off('menuopen', onSubMenuOpen);
    };
  }, [tree, nodeId, parentId]);

  useEffect(() => {
    if (isOpen && tree) {
      tree.events.emit('menuopen', { parentId, nodeId });
    }
  }, [tree, isOpen, nodeId, parentId]);

  return (
    <FloatingNode id={nodeId}>
      <div
        ref={useMergeRefs([refs.setReference, item.ref, forwardedRef])}
        tabIndex={
          !isNested ? undefined : parent.activeIndex === item.index ? 0 : -1
        }
        role={isNested ? 'menuitem' : undefined}
        data-open={isOpen ? '' : undefined}
        data-nested={isNested ? '' : undefined}
        data-focus-inside={hasFocusInside ? '' : undefined}
        className={classNames(
          isNested && menuItemClassNames,
          isNested
            ? 'h-[40px] w-full  border-b border-b-pr-grey-200 px-3 hover:bg-pr-grey-100'
            : 'h-full px-0',
          className,
        )}
        {...getReferenceProps(
          parent.getItemProps({
            ...props,
            onFocus(event: FocusEvent<HTMLButtonElement>) {
              props.onFocus?.(event);
              setHasFocusInside(false);
              parent.setHasFocusInside(true);
            },
          }),
        )}
      >
        {trigger}
        {!trigger && label && (
          <span className="inline-block truncate">{label}</span>
        )}
      </div>
      <MenuContext.Provider
        value={{
          activeIndex,
          setActiveIndex,
          getItemProps,
          setHasFocusInside,
          isOpen,
        }}
      >
        <FloatingList elementsRef={elementsRef} labelsRef={labelsRef}>
          {isOpen && (
            <FloatingPortal id="theme-main">
              <FloatingFocusManager
                context={context}
                modal={false}
                initialFocus={isNested ? -1 : 0}
                returnFocus={noFocusReturn ? false : !isNested}
              >
                <div
                  className={classNames(
                    'z-50 overflow-auto rounded-secondary bg-layer-2 text-primary-bg-light shadow focus-visible:outline-none',
                    listClassName,
                  )}
                  data-qa="dropdown-menu"
                  ref={refs.setFloating}
                  style={{
                    ...floatingStyles,
                    ...style,
                    ...(type === 'dropdown' && {
                      width: `${floatingWidth}px`,
                    }),
                  }}
                  {...getFloatingProps()}
                >
                  {children}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          )}
        </FloatingList>
      </MenuContext.Provider>
    </FloatingNode>
  );
});

interface MenuItemProps {
  label?: string;
  item?: ReactNode;
  disabled?: boolean;
}

export const MenuItem = forwardRef<
  HTMLButtonElement,
  MenuItemProps & ButtonHTMLAttributes<HTMLButtonElement>
>(function MenuItem(
  { className, label, item: ItemComponent, disabled, ...props },
  forwardedRef,
) {
  const menu = useContext(MenuContext);
  const item = useListItem({ label: disabled ? null : label });
  const tree = useFloatingTree();
  const isActive = item.index === menu.activeIndex;

  return (
    <button
      {...props}
      ref={useMergeRefs([item.ref, forwardedRef])}
      type="button"
      role="menuitem"
      className={classNames(
        menuItemClassNames,
        'h-[40px] w-full min-w-[140px] border-b border-b-pr-grey-200 px-3 last:border-b-0 hover:bg-pr-grey-100',
        disabled && '!cursor-not-allowed',
        className,
      )}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      {...menu.getItemProps({
        onClick(event: MouseEvent<HTMLButtonElement>) {
          props.onClick?.(event);
          tree?.events.emit('click');
        },
        onFocus(event: FocusEvent<HTMLButtonElement>) {
          props.onFocus?.(event);
          menu.setHasFocusInside(true);
        },
      })}
    >
      {ItemComponent}
      {!ItemComponent && label && (
        <span className="inline-block truncate">{label}</span>
      )}
    </button>
  );
});

export const Menu = forwardRef<
  HTMLDivElement,
  MenuProps & HTMLProps<HTMLButtonElement>
>(function Menu(props, ref) {
  const parentId = useFloatingParentNodeId();
  if (parentId === null) {
    return (
      <FloatingTree>
        <MenuComponent {...props} ref={ref} />
      </FloatingTree>
    );
  }

  return <MenuComponent {...props} ref={ref} />;
});
