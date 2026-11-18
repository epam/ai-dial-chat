import { useEffect } from 'react';

/* User input, focus, scrolling and viewport changes that end a composer scene. */
const INTERRUPT_EVENTS = [
  'pointerdown',
  'click',
  'keydown',
  'focusin',
  'focusout',
  'beforeinput',
  'input',
  'compositionstart',
  'scroll',
  'resize',
  'visibilitychange',
];

/** Calls `cancel` on user interaction, scrolling, viewport changes or a hidden tab while `isActive`. */
export const useComposerInterrupts = (
  isActive: boolean,
  cancel: () => void,
): void => {
  useEffect(() => {
    if (!isActive) return;
    const handleInterrupt = (event?: Event) => {
      if (event?.type === 'visibilitychange' && !document.hidden) return;
      cancel();
    };
    INTERRUPT_EVENTS.forEach((name) =>
      window.addEventListener(name, handleInterrupt, true),
    );
    window.visualViewport?.addEventListener('resize', handleInterrupt);
    window.visualViewport?.addEventListener('scroll', handleInterrupt);
    return () => {
      INTERRUPT_EVENTS.forEach((name) =>
        window.removeEventListener(name, handleInterrupt, true),
      );
      window.visualViewport?.removeEventListener('resize', handleInterrupt);
      window.visualViewport?.removeEventListener('scroll', handleInterrupt);
    };
  }, [isActive, cancel]);
};
