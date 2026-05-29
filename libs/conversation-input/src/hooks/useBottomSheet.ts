import { useEffect } from 'react';

/**
 * Shared behavior for bottom-sheet overlays: closes the sheet on `Escape`
 * and locks body scrolling while the sheet is open. No-op while closed.
 */
export const useBottomSheet = (isOpen: boolean, onClose: () => void): void => {
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
};
