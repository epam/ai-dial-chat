const VIEWPORT_QUIET_MS = 120;
const MAX_PREPARATION_MS = 600;

/** Let mobile keyboard/browser-chrome transitions settle before borrowing the input. */
export const prepareMobileMummy = (
  onReady: () => void,
  onCancel: () => void,
): (() => void) => {
  const viewport = window.visualViewport;
  const interactions = [
    'pointerdown',
    'keydown',
    'beforeinput',
    'input',
    'compositionstart',
    'focusin',
    'scroll',
    'visibilitychange',
  ];
  let pending = true;
  let quiet: ReturnType<typeof setTimeout>;
  const dispose = () => {
    if (!pending) return false;
    pending = false;
    clearTimeout(quiet);
    clearTimeout(deadline);
    window.removeEventListener('resize', settle);
    viewport?.removeEventListener('resize', settle);
    viewport?.removeEventListener('scroll', settle);
    interactions.forEach((name) =>
      document.removeEventListener(name, cancel, true),
    );
    return true;
  };
  const finish = () => {
    if (dispose()) onReady();
  };
  const cancel = () => {
    if (dispose()) onCancel();
  };
  const settle = () => {
    clearTimeout(quiet);
    quiet = setTimeout(finish, VIEWPORT_QUIET_MS);
  };
  window.addEventListener('resize', settle);
  viewport?.addEventListener('resize', settle);
  viewport?.addEventListener('scroll', settle);
  interactions.forEach((name) => document.addEventListener(name, cancel, true));
  const deadline = setTimeout(finish, MAX_PREPARATION_MS);
  settle();
  return () => {
    dispose();
  };
};
