import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, IconButton } from '@epam/ai-dial-ui-kit';
import { Fragment, memo, useMemo, type FC, type ReactNode } from 'react';
import type {
  NavigationLinkRenderer,
  NavigationPanelItem,
} from '../../models/navigation-item';
import type { NavigationPanelProps } from '../../models/navigation-panel-props';
import styles from './NavigationPanel.module.scss';

const renderPlainLink: NavigationLinkRenderer = (
  item: NavigationPanelItem,
  children: ReactNode,
) => (
  <a href={item.href} className="contents">
    {children}
  </a>
);

/**
 * Vertical primary-navigation rail: brand mark, one icon button per
 * destination, and a pinned footer slot for the user menu.
 */
export const NavigationPanel: FC<NavigationPanelProps> = memo(
  ({
    items,
    labels,
    logo,
    footer,
    renderLink = renderPlainLink,
    styles: panelStyles,
  }) => {
    const { colors, typography, className, cssVars } = panelStyles ?? {};

    const railCssVars = useMemo(
      () =>
        buildCssVars({
          '--np-bg': colors?.background,
          '--np-item-text': colors?.itemText,
          '--np-item-active-text': colors?.itemActiveText,
          '--np-item-selected-bg': colors?.itemSelectedBackground,
          '--np-item-hover-bg': colors?.itemHoverBackground,
          '--np-item-active-bg': colors?.itemActiveBackground,
          '--np-font-family': typography?.fontFamily,
        }),
      [colors, typography?.fontFamily],
    );

    return (
      <nav
        aria-label={labels.ariaLabel}
        style={{ ...cssVars, ...railCssVars }}
        className={mergeClasses(
          styles.rail,
          'relative z-10 flex h-full w-[60px] flex-col justify-between shadow-[0_2px_6px_0_var(--shadow-xs-sm-2,#161B2D08)]',
          typography?.fontClassName,
          className,
        )}
      >
        <div className="flex flex-col items-center">
          {logo && (
            <a
              href={logo.href ?? '/'}
              aria-label={logo.ariaLabel}
              className="flex h-16 w-full shrink-0 items-center justify-center"
            >
              <span
                style={{ backgroundImage: `url(${logo.iconUrl})` }}
                className="h-6 w-6 bg-contain bg-center bg-no-repeat"
              />
            </a>
          )}
          <div className="flex flex-col items-center gap-2 p-2">
            {items.map((item) => (
              <Fragment key={item.id}>
                {renderLink(
                  item,
                  <IconButton
                    icon={<item.icon size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
                    aria-label={item.label}
                    aria-current={item.isActive ? 'page' : undefined}
                    tooltipProps={{ tooltip: item.label }}
                    tabIndex={-1}
                    className={mergeClasses(
                      styles.item,
                      'rounded-xl',
                      item.isActive && styles.itemActive,
                    )}
                  />,
                )}
              </Fragment>
            ))}
          </div>
        </div>
        {footer}
      </nav>
    );
  },
);
