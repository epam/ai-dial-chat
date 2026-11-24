import { memo, type FC, type ReactNode } from 'react';
import { useDeferredOverlayMount } from '../../hooks/useDeferredOverlayMount';

interface Props {
  /** Whether the prompt catalog modal is open. */
  isOpen: boolean;
  /** The lazily loaded modal. */
  children: ReactNode;
}

/**
 * Renders the prompt catalog modal only after the page has loaded, or once it
 * opens if that comes first, so its chunk stays out of first paint. A
 * component rather than a hook call because the prompt selector renders the
 * catalog from a callback, where hooks cannot run.
 */
const PromptCatalogGate: FC<Props> = ({ isOpen, children }) => {
  const isMounted = useDeferredOverlayMount(isOpen);
  return isMounted ? children : null;
};

export default memo(PromptCatalogGate);
