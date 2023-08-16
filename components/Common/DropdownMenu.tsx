import {
  FloatingFocusManager,
  FloatingList,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
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

const menuItemClassNames =
  'flex focus-visible:border-none focus-visible:outline-none gap-3 cursor-pointer px-3 items-center';

const MenuContext = createContext<{
  getItemProps: (userProps?: HTMLProps<HTMLElement>) => Record<string, unknown>;
  activeIndex: number | null;
  setActiveIndex: Dispatch<SetStateAction<number | null>>;
  setHasFocusInside: Dispatch<SetStateAction<boolean>>;
  isOpen: boolean;
}>({
  getItemProps: () => ({}),
  activeIndex: null,
  setActiveIndex: () => ({}),
  setHasFocusInside: () => ({}),
  isOpen: false,
});

interface MenuProps {
  trigger?: ReactNode;
  nested?: boolean;
  children?: ReactNode;
  type?: 'dropdown' | 'contextMenu';
  onOpenChange?: (isOpen: boolean) => void;
}

export const MenuComponent = forwardRef<
  HTMLButtonElement,
  MenuProps & HTMLProps<HTMLButtonElement>
>(function MenuComponent(
  {
    children,
    style,
    className,
    label,
    trigger,
    type = 'dropdown',
    onOpenChange,
    ...props
  },
  forwardedRef,
) {
  const [isOpen, setIsOpen] = useState(false);
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

  const { floatingStyles, refs, context } = useFloating<HTMLButtonElement>({
    nodeId,
    open: isOpen,
    onOpenChange: (isOpened) => {
      setIsOpen(isOpened);
      onOpenChange?.(isOpened);
    },
    placement: isNested ? 'right-start' : 'bottom-start',
    middleware: [
      offset(0),
      flip(),
      shift(),
      size({
        apply({ rects }) {
          setFloatingWidth(rects.reference.width);
        },
      }),
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
    ignoreMouse: isNested,
  });
  const role = useRole(context, { role: 'menu' });
  const dismiss = useDismiss(context, { bubbles: true });
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
      <button
        ref={useMergeRefs([refs.setReference, item.ref, forwardedRef])}
        tabIndex={
          !isNested ? undefined : parent.activeIndex === item.index ? 0 : -1
        }
        role={isNested ? 'menuitem' : undefined}
        data-open={isOpen ? '' : undefined}
        data-nested={isNested ? '' : undefined}
        data-focus-inside={hasFocusInside ? '' : undefined}
        className={classNames(
          menuItemClassNames,
          isNested ? 'h-[42px] w-full' : 'h-full pr-0',
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
        {!trigger && label && <span>{label}</span>}
      </button>
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
                returnFocus={!isNested}
              >
                <div
                  className="z-50 overflow-hidden rounded bg-gray-100 text-gray-800 shadow focus-visible:outline-none dark:bg-black dark:text-gray-200"
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
      className={classNames(menuItemClassNames, 'h-[42px] w-full', className)}
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
      {!ItemComponent && label && <span>{label}</span>}
    </button>
  );
});

export const Menu = forwardRef<
  HTMLButtonElement,
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
