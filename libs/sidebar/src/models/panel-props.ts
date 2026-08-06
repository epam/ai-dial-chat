import type { CSSProperties, ReactNode } from 'react';
import { SidebarOrientation } from '../types/orientation';

/** CSS custom-property overrides for the `SidebarPanel` component. */
export interface SidebarPanelColors {
  /** Panel background color. */
  background?: string;
  /** Divider border color on the inner edge. */
  border?: string;
  /** Border color on the outer (inline-end) edge. Defaults to `border`. */
  borderInlineEnd?: string;
  /** Header text color. */
  text?: string;
  /** Resize handle color (icon and background). */
  resizeHandler?: string;
}

/** Typography overrides for the `SidebarPanel` component. */
export interface SidebarPanelTypography {
  /** CSS class applied to the panel root, inherited by all panel content. */
  fontClassName?: string;
}

/** Localised accessible labels for the `SidebarPanel` component. */
export interface SidebarPanelLabels {
  /** Accessible label for the panel region. */
  ariaLabel: string;
  /** Accessible label and tooltip for the close button. Required when `onClose` is provided. */
  closeLabel?: string;
}

/** Combined style overrides (colors and typography) for the `SidebarPanel` component. */
export interface SidebarPanelStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: SidebarPanelColors;
  /** Typography overrides applied via CSS custom properties. */
  typography?: SidebarPanelTypography;
  /** CSS class applied to the header title element. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** Extra class name(s) merged onto the scrollable body `<div>`. */
  bodyClassName?: string;
  /** Extra class name(s) merged onto the panel width wrapper `<div>`. */
  className?: string;
  /** CSS class applied to the header element. */
  headerClassName?: string;
  /** CSS custom properties applied to the panel `<aside>` element. */
  cssVars?: CSSProperties;
}

/** Props accepted by the `SidebarPanel` component. */
export interface SidebarPanelProps {
  /** Whether the panel is open; drives the slide-in animation and sets `aria-hidden` when closed. */
  isOpen: boolean;
  /** Edge the panel anchors to; drives the divider side and close-button placement. */
  orientation: SidebarOrientation;
  /** Title rendered in the header bar between the start and end action slots. */
  title?: ReactNode;

  /** Rendered in the left group of the 48 px header bar. */
  leftActions?: ReactNode;
  /** Content for the end (right) slot of the header bar. */
  rightActions?: ReactNode;
  /** Called when the user closes the panel; omit to hide the close button. */
  onClose?: () => void;
  /** Localised accessible labels for the panel region and close button. */
  labels: SidebarPanelLabels;
  /** Body content rendered below the header bar in the scrollable region. */
  children: ReactNode;
  /** Style overrides for colors, typography, and element class names. */
  styles?: SidebarPanelStyles;
  /** Enables drag-to-resize on the panel edge opposite to `orientation`. Defaults to `false`. */
  resizable?: boolean;
  /** Initial panel width in px used when `resizable` is true. Defaults to `360`. */
  defaultWidth?: number;
  /** Minimum panel width in px used when `resizable` is true. Defaults to `280`. */
  minWidth?: number;
  /** Maximum panel width in px used when `resizable` is true. Defaults to `600`. */
  maxWidth?: number;
  /** Called with the new width in px when the user finishes a resize drag. */
  onResizeStop?: (width: number) => void;
}
