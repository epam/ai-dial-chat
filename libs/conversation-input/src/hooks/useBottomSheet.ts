import { useEffect, type RefObject } from 'react';

/*
 * The standard focusable-element set for the Tab cycle. `:not([disabled])`
 * keeps disabled controls out, and `[tabindex]:not([tabindex="-1"])` admits
 * programmatic focus targets the sheet may host while excluding the sheet
 * container itself (which carries `tabIndex={-1}` as the focus fallback).
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Handles Escape-to-close, body-scroll-locking, and dialog focus management
 * (initial focus, Tab trapping, and focus restoration on close) for a
 * bottom-sheet overlay. Pass the sheet container ref so focus can be moved
 * into the sheet on open and returned to the triggering element on close.
 */
export const useBottomSheet = (
  isOpen: boolean,
  onClose: () => void,
  sheetRef?: RefObject<HTMLElement | null>,
): void => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || sheetRef?.current == null) return;
    const sheet = sheetRef.current;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    /*
     * Without this the sheet opens with focus left on the trigger behind the
     * `aria-modal` backdrop — a keyboard user Tabs through the hidden page
     * while assistive tech reports focus is contained in the dialog
     * (WCAG 2.1.2 / 2.4.3). Initial focus lands on the first focusable
     * element (the back/close control or a search field), falling back to
     * the sheet itself, which BottomSheetShell renders with `tabIndex={-1}`
     * so it is at least focusable and announced.
     */
    const initialFocusTarget =
      sheet.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? sheet;
    initialFocusTarget.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = Array.from(
        sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusables.length === 0) {
        // Nothing to cycle into — keep focus on the sheet itself.
        e.preventDefault();
        sheet.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const isWrapPoint =
        active === sheet || active === null || !sheet.contains(active);
      if (e.shiftKey) {
        // Shift+Tab from the first focusable (or from outside the sheet)
        // wraps to the last; from anywhere else the browser moves normally.
        if (active === first || isWrapPoint) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || isWrapPoint) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
    // `sheetRef` is a stable ref object; the sheet element is only read at
    // open time and inside the handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sheetRef]);
};
