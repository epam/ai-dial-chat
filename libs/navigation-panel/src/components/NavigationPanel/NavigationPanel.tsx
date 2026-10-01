import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  IconButton,
} from '@epam/ai-dial-ui-kit';
import { Fragment, memo, useId, useMemo, type FC, type ReactNode } from 'react';
import { NAVIGATION_PANEL_CLASS } from '../../constants/public-class-names';
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
    const gradientIdBase = useId().replace(/[^\w-]/g, '');
    const hoverGradientId = `np-hover-gradient-${gradientIdBase}`;
    const activeGradientId = `np-active-gradient-${gradientIdBase}`;

    const railCssVars = useMemo(
      () =>
        buildCssVars({
          '--np-bg': colors?.background,
          '--np-item-text': colors?.itemText,
          '--np-item-active-text': colors?.itemActiveText,
          '--np-item-selected-bg': colors?.itemSelectedBackground,
          '--np-item-hover-bg': colors?.itemHoverBackground,
          '--np-item-hover-icon':
            colors?.itemHoverIcon ?? `url(#${hoverGradientId})`,
          '--np-item-active-icon':
            colors?.itemActiveIcon ?? `url(#${activeGradientId})`,
          '--np-item-active-bg': colors?.itemActiveBackground,
          '--np-font-family': typography?.fontFamily,
        }),
      [colors, typography?.fontFamily, hoverGradientId, activeGradientId],
    );

    return (
      <nav
        aria-label={labels.ariaLabel}
        style={{ ...cssVars, ...railCssVars }}
        className={mergeClasses(
          styles.rail,
          'relative z-10 flex h-full w-[60px] flex-col justify-between shadow-sm',
          typography?.fontClassName,
          className,
          NAVIGATION_PANEL_CLASS.rail,
        )}
      >
        {/* Paint servers for the icon glyphs, each a CSS `linear-gradient`
            mapped onto the 24×24 Tabler viewBox; `display: none` would drop
            them. Hover stroke: `231.48deg, #1d4ed8 -19.06%, #885df2 112.96%`.
            Selected fill: `234.7deg, #1d4ed8 -20.66%, #885df2 93.19%`. */}
        <svg aria-hidden className="absolute size-0" focusable="false">
          <defs>
            <linearGradient
              id={hoverGradientId}
              gradientUnits="userSpaceOnUse"
              x1="30.2"
              y1="-2.5"
              x2="-4.6"
              y2="25.2"
            >
              <stop offset="0" stopColor="#1d4ed8" />
              <stop offset="1" stopColor="#885df2" />
            </linearGradient>
            <linearGradient
              id={activeGradientId}
              gradientUnits="userSpaceOnUse"
              x1="31.3"
              y1="-1.7"
              x2="0.2"
              y2="20.4"
            >
              <stop offset="0" stopColor="#1d4ed8" />
              <stop offset="1" stopColor="#885df2" />
            </linearGradient>
          </defs>
        </svg>
        <div className="flex flex-col items-center">
          {logo && (
            <a
              href={logo.href ?? '/'}
              aria-label={logo.ariaLabel}
              className="flex h-16 w-full shrink-0 items-center justify-center"
            >
              <span
                /* Quoted: an inlined SVG data URL carries `'` characters,
                   which invalidate an unquoted `url()`. */
                style={{ backgroundImage: `url("${logo.iconUrl}")` }}
                className="h-6 w-6 bg-contain bg-center bg-no-repeat"
              />
            </a>
          )}
          <div className="flex flex-col items-center gap-2 p-2">
            {items.map((item) => {
              /* An active item is always filled: with the dedicated
                 `activeIcon` glyph when the host supplies one, otherwise by
                 filling the outline `icon` in place. */
              const hasActiveGlyph = !!item.isActive && !!item.activeIcon;
              const Icon = (hasActiveGlyph && item.activeIcon) || item.icon;

              return (
                <Fragment key={item.id}>
                  {renderLink(
                    item,
                    <IconButton
                      icon={
                        <Icon
                          size={DIAL_ICON_SIZE.LG}
                          stroke={DIAL_KIT_ICON_STROKE}
                        />
                      }
                      aria-label={item.label}
                      aria-current={item.isActive ? 'page' : undefined}
                      tooltipProps={{ tooltip: item.label }}
                      tabIndex={-1}
                      className={mergeClasses(
                        styles.item,
                        'rounded-xl',
                        item.isActive && styles.itemActive,
                        hasActiveGlyph && styles.itemFilled,
                        item.isActive &&
                          !hasActiveGlyph &&
                          styles.itemFilledOutline,
                        NAVIGATION_PANEL_CLASS.item,
                      )}
                    />,
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
        {footer}
      </nav>
    );
  },
);
