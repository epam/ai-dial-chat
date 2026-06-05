import type { ReactNode } from 'react';

/** Which edge of the viewport the panel anchors to. */
export enum SidebarSide {
  /** Panel anchors to the left edge. */
  Left = 'left',
  /** Panel anchors to the right edge. */
  Right = 'right',
}

/** CSS custom-property overrides for the `SidebarPanel` component. */
export interface SidebarPanelColors {
  /** Panel background color. */
  background?: string;
  /** Divider border color on the inner edge. */
  border?: string;
  /** Header bar bottom-border color. */
  headerBorder?: string;
}

/** Typography overrides for the `SidebarPanel` component. */
export interface SidebarPanelTypography {
  /**
   * A Tailwind font utility class applied to the panel root.
   * When provided, individual `fontFamily` / `fontSize` vars are skipped.
   */
  fontClassName?: string;
  /** Font family applied to the panel root via CSS custom property. */
  fontFamily?: string;
  /** Font size applied to the panel root via CSS custom property. */
  fontSize?: string;
}

/** Combined style overrides (colors and typography) for the `SidebarPanel` component. */
export interface SidebarPanelStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: SidebarPanelColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: SidebarPanelTypography;
}

/** Props accepted by the `SidebarPanel` component. */
export interface SidebarPanelProps {
  /**
   * Which edge the panel anchors to.
   * Controls the divider side (`border-l` vs `border-r`) and
   * the close-button placement (outer edge of the panel).
   * `leftActions` / `rightActions` are header-bar positions and are
   * independent of this prop.
   */
  side: SidebarSide;
  /** Rendered in the left group of the 48 px header bar. */
  leftActions?: ReactNode;
  /**
   * Rendered in the right group of the 48 px header bar, immediately
   * before the built-in close button when `side === 'right'`.
   */
  rightActions?: ReactNode;
  /** Called when the user activates the built-in close button. */
  onClose: () => void;
  /** Accessible label for the panel region. Caller supplies the localised string. */
  ariaLabel: string;
  /** Accessible label and tooltip for the built-in close button. Caller supplies the localised string. */
  closeLabel: string;
  /** Body content rendered below the header bar in the scrollable region. */
  children: ReactNode;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: SidebarPanelStyles;
  /** Extra class name(s) merged onto the root `<aside>` element. */
  className?: string;
}
