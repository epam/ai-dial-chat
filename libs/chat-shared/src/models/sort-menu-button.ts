import type { ElementSize } from '@epam/ai-dial-ui-kit';
import type { ReactNode } from 'react';

/** One order offered by `SortMenuButton`. */
export interface SortMenuButtonOption {
  /** Value reported through `onChange` when the option is picked. */
  value: string;
  /** Menu label of the option. */
  label: string;
}

/** CSS custom-property overrides for `SortMenuButton`. */
export interface SortMenuButtonColors {
  /** Sort glyph color. Defaults to `--text-secondary`. */
  icon?: string;
}

/** Props for `SortMenuButton`. */
export interface SortMenuButtonProps {
  /** Orders listed in the menu, in display order; an empty list renders nothing. */
  options: SortMenuButtonOption[];
  /** Value of the applied order; the matching menu row is checked. */
  value?: string;
  /** Called with the picked option's `value`. */
  onChange: (value: string) => void;
  /** Accessible name and tooltip of the trigger. Defaults to `'Sort'`. */
  label?: string;
  /** Glyph drawn in the trigger. Defaults to `IconArrowsSort`. */
  icon?: ReactNode;
  /** Trigger size. Defaults to `ElementSize.Standard`. */
  size?: ElementSize;
  /** Size of the default glyph in pixels. Defaults to `DIAL_ICON_SIZE.MD`. */
  iconSize?: number;
  /** Color overrides applied as CSS custom properties. */
  colors?: SortMenuButtonColors;
  /** CSS class applied to the trigger button. */
  className?: string;
  /** Controlled open state of the menu; uncontrolled when omitted. */
  open?: boolean;
  /** Called whenever the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
}
