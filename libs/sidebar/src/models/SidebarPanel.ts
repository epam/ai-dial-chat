import type { CSSProperties, ReactNode } from 'react';

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
   * Whether the panel is currently open.
   * When provided, the wrapper adds a slide-in width animation and
   * `aria-hidden` is set on the panel when closed.
   */
  isOpen: boolean;
  /**
   * Which edge the panel anchors to.
   * Controls the divider side (`border-l` vs `border-r`) and
   * the close-button placement (outer edge of the panel).
   * `leftActions` / `rightActions` are header-bar positions and are
   * independent of this prop.
   */
  side: SidebarSide;
  /**
   * Title text rendered in the header bar between the action groups.
   * Truncated with an ellipsis when the panel is too narrow.
   */
  title?: ReactNode;
  /**
   * Typography class applied to the title element.
   * Defaults to `'dial-body-semi-text'`.
   */
  titleClassName?: string;
  /** Rendered in the left group of the 48 px header bar. */
  leftActions?: ReactNode;
  /**
   * Rendered in the right group of the 48 px header bar, immediately
   * before the built-in close button when `side === 'right'`.
   */
  rightActions?: ReactNode;
  /**
   * Called when the user activates the built-in close button.
   * When omitted the close button is not rendered.
   */
  onClose?: () => void;
  /** Accessible label for the panel region. Caller supplies the localised string. */
  ariaLabel: string;
  /**
   * Accessible label and tooltip for the built-in close button.
   * Required when `onClose` is provided.
   */
  closeLabel?: string;
  /** Body content rendered below the header bar in the scrollable region. */
  children: ReactNode;
  /** Color and typography overrides applied as CSS custom properties. */
  styles?: SidebarPanelStyles;
  /** Extra class name(s) merged onto the root `<aside>` element. */
  className?: string;
  /** Extra class name(s) merged onto the scrollable body `<div>`. */
  bodyClassName?: string;
  /** CSS custom properties applied to the scrollable body `<div>`. */
  cssVars?: CSSProperties;
  /**
   * Enables drag-to-resize on the panel edge opposite to `side`.
   * When false (default) the panel renders at a width determined by `className`.
   * Automatically disabled when `isOpen` is false.
   */
  resizable?: boolean;
  /** Initial panel width in px used when `resizable` is true. */
  defaultWidth?: number;
  /** Minimum panel width in px used when `resizable` is true. */
  minWidth?: number;
  /** Maximum panel width in px used when `resizable` is true. */
  maxWidth?: number;
  /** Called with the new width in px when the user finishes a resize drag. */
  onResizeStop?: (width: number) => void;
}
