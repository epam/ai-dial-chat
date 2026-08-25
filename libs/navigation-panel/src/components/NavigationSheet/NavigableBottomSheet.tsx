import { BottomSheetShell } from '@epam/ai-dial-conversation-input';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FC,
  type ReactNode,
} from 'react';
import { SheetNavigationContext } from '../../context/SheetNavigationContext';
import type { SheetPage } from '../../models/sheet-navigation';

/** Props for `NavigableBottomSheet`. */
export interface NavigableBottomSheetProps {
  /** Controls sheet visibility; closing resets the page stack. */
  isOpen: boolean;
  /** Called when the sheet should close (backdrop tap, close button, or Escape). */
  onClose: () => void;
  /** Root-page body, shown whenever the stack is empty. */
  children: ReactNode;
  /** Root-page header title. Required for accessibility. */
  title: string;
  /** Accessible name for the close (×) button. */
  closeLabel: string;
  /** Accessible name for the back button shown on pushed pages. */
  backLabel: string;
  /** Extra class name(s) merged onto the sheet container. */
  className?: string;
  /** CSS custom properties forwarded to the sheet root for theming. */
  style?: CSSProperties;
}

/**
 * Bottom sheet with an in-sheet page stack: content pushes and pops pages
 * through `useSheetNavigation`, and the header swaps its title and back button
 * to match the top page.
 */
export const NavigableBottomSheet: FC<NavigableBottomSheetProps> = memo(
  ({
    isOpen,
    onClose,
    children,
    title,
    closeLabel,
    backLabel,
    className,
    style,
  }) => {
    const [stack, setStack] = useState<SheetPage[]>([]);

    useEffect(() => {
      if (!isOpen) setStack([]);
    }, [isOpen]);

    const push = useCallback((page: SheetPage) => {
      setStack((prev) => [...prev, page]);
    }, []);

    const pop = useCallback(() => {
      setStack((prev) => prev.slice(0, -1));
    }, []);

    const close = useCallback(() => {
      setStack([]);
      onClose();
    }, [onClose]);

    const contextValue = useMemo(
      () => ({ push, pop, close }),
      [push, pop, close],
    );

    const topPage = stack[stack.length - 1];

    return (
      <SheetNavigationContext.Provider value={contextValue}>
        <BottomSheetShell
          isOpen={isOpen}
          onClose={close}
          title={topPage?.title ?? title}
          closeLabel={closeLabel}
          onBack={topPage ? pop : undefined}
          backLabel={topPage ? backLabel : undefined}
          className={className}
          style={style}
        >
          {topPage ? topPage.content : children}
        </BottomSheetShell>
      </SheetNavigationContext.Provider>
    );
  },
);
