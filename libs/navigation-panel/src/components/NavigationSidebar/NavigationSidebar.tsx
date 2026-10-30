import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
  Tooltip,
} from '@epam/ai-dial-ui-kit';
import { IconLayoutSidebar, IconX } from '@tabler/icons-react';
import {
  Fragment,
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  type FC,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { NAVIGATION_PANEL_CLASS } from '../../constants/public-class-names';
import type {
  NavigationPanelItem,
  NavigationSidebarLinkRenderer,
} from '../../models/navigation-item';
import type { NavigationSidebarProps } from '../../models/navigation-sidebar-props';
import { NavigationSidebarVariant } from '../../types/navigation-sidebar-variant';
import { ItemGradients } from '../common/ItemGradients';
import styles from './NavigationSidebar.module.scss';

const renderPlainLink: NavigationSidebarLinkRenderer = (
  item: NavigationPanelItem,
  children: ReactNode,
  linkProps,
) => (
  <a href={item.href} {...linkProps}>
    {children}
  </a>
);

const getWidthClassName = (isDrawer: boolean, isCollapsed: boolean): string => {
  if (isDrawer) return 'w-[320px] max-w-full';
  return isCollapsed ? 'w-[72px]' : 'w-[336px]';
};

/* A column keeps its place in the layout and animates its width; a drawer is
   fixed to the start edge and slides in from it (RTL-aware). */
const getRootClassName = (isDrawer: boolean, isOpen: boolean): string => {
  if (!isDrawer) {
    return mergeClasses(
      styles.sidebarColumn,
      'relative z-10 flex h-full shrink-0 flex-col overflow-hidden shadow-sm',
    );
  }
  return mergeClasses(
    'fixed inset-y-0 inset-s-0 z-50 flex flex-col overflow-hidden shadow-sm outline-none',
    'transition-[transform,visibility] duration-200 ease-in-out motion-reduce:transition-none',
    isOpen
      ? 'visible translate-x-0'
      : 'invisible ltr:-translate-x-full rtl:translate-x-full',
  );
};

/** Primary-navigation sidebar: items, a content slot and a footer, as a collapsible column or a drawer. */
export const NavigationSidebar: FC<NavigationSidebarProps> = memo(
  ({
    items,
    labels,
    variant = NavigationSidebarVariant.Sidebar,
    isCollapsed: isCollapsedProp = false,
    onToggleCollapse,
    isOpen = false,
    onClose,
    id,
    logo,
    renderLink = renderPlainLink,
    children,
    userMenu,
    footerActions,
    styles: sidebarStyles,
  }) => {
    const { colors, typography, className, cssVars } = sidebarStyles ?? {};
    const labelClassName = typography?.fontClassName ?? 'dial-small-text';
    const isDrawer = variant === NavigationSidebarVariant.Drawer;
    /* A drawer is always expanded: it is either shown or not shown at all. */
    const isCollapsed = !isDrawer && isCollapsedProp;
    const generatedId = useId();
    const sidebarId = id ?? generatedId;
    const activeGradientId = `np-sidebar-gradient-${generatedId.replace(/[^\w-]/g, '')}`;
    const rootRef = useRef<HTMLElement>(null);
    const returnFocusRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(isOpen);

    /* Focus moves into an opening drawer and back to the control that opened
       it once it closes; a drawer that is open on mount keeps the focus where
       it is. */
    useEffect(() => {
      const wasOpen = wasOpenRef.current;
      wasOpenRef.current = isOpen;
      if (!isDrawer) return;
      if (isOpen && !wasOpen) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        rootRef.current?.focus();
      } else if (!isOpen && wasOpen) {
        returnFocusRef.current?.focus();
        returnFocusRef.current = null;
      }
    }, [isDrawer, isOpen]);

    const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      /* React bubbles events through portals, so an Escape from a dialog or
         menu a child renders elsewhere in the DOM is not the drawer's. */
      if (!event.currentTarget.contains(event.target as Node)) return;
      if (event.key === 'Escape') onClose?.();
    };

    const rootCssVars = useMemo(
      () =>
        buildCssVars({
          '--np-sidebar-bg': colors?.background,
          '--np-sidebar-item-text': colors?.itemText,
          '--np-sidebar-item-hover-bg': colors?.itemHoverBackground,
          '--np-sidebar-item-selected-bg': colors?.itemSelectedBackground,
          '--np-sidebar-focus-outline': colors?.focusOutline,
          '--np-sidebar-gradient-start': colors?.itemActiveGradientStart,
          '--np-sidebar-gradient-end': colors?.itemActiveGradientEnd,
          '--np-sidebar-item-active-icon':
            colors?.itemActiveIcon ?? `url(#${activeGradientId})`,
          '--np-sidebar-font-family': typography?.fontFamily,
        }),
      [colors, typography?.fontFamily, activeGradientId],
    );

    const toggleLabel = isCollapsed
      ? (labels.expand ?? 'Expand sidebar')
      : (labels.collapse ?? 'Collapse sidebar');
    const toggleName = labels.toggle ?? 'Sidebar';
    const closeLabel = labels.close ?? 'Close';

    const renderMark = (url: string, markClassName: string) => (
      <span
        /* Quoted: an inlined SVG data URL carries `'` characters, which
           invalidate an unquoted `url()`. */
        style={{ backgroundImage: `url("${url}")` }}
        className={mergeClasses(
          'bg-contain bg-center bg-no-repeat',
          markClassName,
        )}
      />
    );

    const renderToggle = () => (
      <GhostIconButton
        icon={
          <span className="relative block size-6 shrink-0">
            {isCollapsed &&
              logo &&
              renderMark(
                logo.iconUrl,
                'absolute inset-0 transition-opacity group-focus-visible/toggle:opacity-0 group-hover/toggle:opacity-0',
              )}
            <IconLayoutSidebar
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
              className={mergeClasses(
                'absolute inset-0 rtl:scale-x-[-1]',
                isCollapsed &&
                  logo &&
                  'opacity-0 group-hover/toggle:opacity-100 group-focus-visible/toggle:opacity-100',
              )}
              aria-hidden
            />
          </span>
        }
        size={ElementSize.Large}
        aria-label={toggleName}
        aria-expanded={!isCollapsed}
        aria-controls={sidebarId}
        tooltipProps={{ tooltip: toggleLabel }}
        onClick={onToggleCollapse}
        className="group/toggle size-10! min-h-0! min-w-0! shrink-0 rounded-full! p-2!"
      />
    );

    const renderCloseButton = () => (
      <GhostIconButton
        icon={
          <IconX
            size={DIAL_ICON_SIZE.LG}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
          />
        }
        size={ElementSize.Large}
        aria-label={closeLabel}
        tooltipProps={{ tooltip: closeLabel }}
        onClick={onClose}
        className="size-10! min-h-0! min-w-0! shrink-0 rounded-full! p-2!"
      />
    );

    const renderLogoLink = () =>
      logo && (
        <a
          href={logo.href ?? '/'}
          aria-label={logo.ariaLabel}
          className={mergeClasses(
            'flex h-10 items-center',
            !isDrawer && 'ps-2',
          )}
        >
          {renderMark(
            isCollapsed ? logo.iconUrl : (logo.logoUrl ?? logo.iconUrl),
            isCollapsed ? 'size-6' : 'h-6 min-w-[116px]',
          )}
        </a>
      );

    /* The toggle keeps one position in this tree in both states, so it is not
       remounted on collapse and keeps keyboard focus. */
    const renderDrawerHeader = () => (
      <div className="flex shrink-0 items-center justify-between ps-4 pe-2 pt-3 pb-2">
        {renderLogoLink()}
        {onClose && renderCloseButton()}
      </div>
    );

    const renderHeader = () => (
      <>
        {!(isCollapsed && onToggleCollapse) && renderLogoLink()}
        {onToggleCollapse && renderToggle()}
      </>
    );

    const renderItem = (item: NavigationPanelItem) => {
      /* An active item is always filled: with the dedicated `activeIcon` glyph
         when the host supplies one, otherwise by filling the outline `icon`. */
      const hasActiveGlyph = !!item.isActive && !!item.activeIcon;
      const Icon = (hasActiveGlyph && item.activeIcon) || item.icon;
      const icon = (
        <span
          className={mergeClasses(
            'flex size-6 shrink-0 items-center justify-center',
            styles.itemIcon,
          )}
        >
          <Icon size={DIAL_ICON_SIZE.LG} stroke={DIAL_KIT_ICON_STROKE} />
        </span>
      );
      /* The link is the item itself, so no control sits inside it. Collapsed,
         the label stays in the link as screen-reader text and the tooltip
         shows it to pointer and keyboard users. */
      const link = renderLink(
        item,
        <>
          {icon}
          <span className={isCollapsed ? 'sr-only' : labelClassName}>
            {item.label}
          </span>
        </>,
        {
          className: mergeClasses(
            'flex items-center rounded-full p-2 no-underline',
            isCollapsed ? 'size-10 justify-center' : 'h-10 w-full gap-2',
            styles.item,
            item.isActive && styles.itemActive,
            hasActiveGlyph && styles.itemFilled,
            item.isActive && !hasActiveGlyph && styles.itemFilledOutline,
            NAVIGATION_PANEL_CLASS.sidebarItem,
          ),
          'aria-current': item.isActive ? 'page' : undefined,
        },
      );

      return (
        <li key={item.id}>
          {isCollapsed ? (
            <Tooltip tooltip={item.label} asChild>
              {link}
            </Tooltip>
          ) : (
            link
          )}
        </li>
      );
    };

    const footerContent = isCollapsed ? (
      <Fragment>
        {footerActions}
        {userMenu}
      </Fragment>
    ) : (
      <Fragment>
        {userMenu}
        {footerActions}
      </Fragment>
    );

    return (
      /* The drawer takes focus programmatically (`tabIndex={-1}`) so Escape
         reaches this handler from anywhere inside it. */
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      <nav
        ref={rootRef}
        id={sidebarId}
        aria-label={labels.ariaLabel}
        tabIndex={isDrawer ? -1 : undefined}
        inert={isDrawer && !isOpen}
        onKeyDown={isDrawer ? handleKeyDown : undefined}
        style={{ ...cssVars, ...rootCssVars }}
        className={mergeClasses(
          styles.sidebar,
          getRootClassName(isDrawer, isOpen),
          getWidthClassName(isDrawer, isCollapsed),
          className,
          NAVIGATION_PANEL_CLASS.sidebar,
        )}
      >
        {!colors?.itemActiveIcon && (
          <ItemGradients activeGradientId={activeGradientId} />
        )}

        {isDrawer ? (
          <div className="flex shrink-0 flex-col">
            {renderDrawerHeader()}
            <ul className="m-0 flex list-none flex-col gap-1 p-2">
              {items.map(renderItem)}
            </ul>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col gap-4 p-4">
            <div className="flex h-10 items-center justify-between">
              {renderHeader()}
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {items.map(renderItem)}
            </ul>
          </div>
        )}

        {/* Kept mounted so the list holds its scroll position and rows; the
            fixed-width inner box keeps it from reflowing while the sidebar
            width animates, and it is hidden and inert while collapsed. */}
        <div
          inert={isCollapsed}
          className={mergeClasses(
            'min-h-0 flex-1 overflow-hidden',
            isCollapsed && 'invisible',
          )}
        >
          <div
            className={mergeClasses(
              'flex h-full flex-col',
              isDrawer ? 'w-full' : 'w-[336px]',
            )}
          >
            {children}
          </div>
        </div>

        <div
          className={mergeClasses(
            'flex shrink-0 px-4 py-3 shadow-lg',
            styles.footer,
            isCollapsed
              ? 'flex-col items-start gap-2'
              : 'items-center justify-between gap-2',
            NAVIGATION_PANEL_CLASS.sidebarFooter,
          )}
        >
          {footerContent}
        </div>
      </nav>
    );
  },
);
