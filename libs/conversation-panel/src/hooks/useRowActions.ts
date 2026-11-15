import type { DropdownItem } from '@epam/ai-dial-ui-kit';
import { useCallback, useMemo, useState } from 'react';

/** The ⋮ menu state of a row, for `RowActionsMenu`. */
export interface RowActions {
  /** The menu entries; empty when the row offers none. */
  menuItems: DropdownItem[];
  /** The row offers at least one action, so its trigger renders. */
  hasActions: boolean;
  /** Whether the menu is open. */
  isMenuOpen: boolean;
  /** Records the menu opening or closing. */
  handleOpenChange: (isOpen: boolean) => void;
  /** Reports the opened menu's trigger to the host. */
  handleOpen: (trigger: HTMLButtonElement) => void;
}

/** Returns the ⋮ menu state of a row that shows `subject`. */
export const useRowActions = <T>(
  subject: T,
  getActions: ((subject: T) => DropdownItem[]) | undefined,
  onActionMenuOpen:
    ((subject: T, trigger: HTMLButtonElement) => void) | undefined,
): RowActions => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  /* Built only when the row renders with a new subject or a new
     `getActions`; a host's new `getActions` still refreshes an open menu. */
  const menuItems = useMemo(
    () => getActions?.(subject) ?? [],
    [getActions, subject],
  );
  const handleOpen = useCallback(
    (trigger: HTMLButtonElement) => onActionMenuOpen?.(subject, trigger),
    [onActionMenuOpen, subject],
  );
  return {
    menuItems,
    hasActions: menuItems.length > 0,
    isMenuOpen,
    handleOpenChange: setIsMenuOpen,
    handleOpen,
  };
};
