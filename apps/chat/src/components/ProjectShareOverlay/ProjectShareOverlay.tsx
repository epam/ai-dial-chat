import { makeOutsideInert } from '@epam/ai-dial-chat-shared';
import { memo, useEffect, useRef, type FC, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import SharePopoverContainer from '../SharePopoverContainer/SharePopoverContainer';

/** Props for `ProjectShareOverlay`. */
interface Props {
  /** DIAL Core id of the project being shared. */
  projectId: string;
  /** Called when the overlay should close. */
  onClose: () => void;
}

/**
 * Shows the share popover for a project over the page. The catalog anchors
 * the same popover to its Share button; the project page and the sidebar open
 * it from a ⋮ menu, which has closed by then, so it is centred on a backdrop
 * instead. The overlay is modal: while it is open, the rest of the page leaves
 * the tab order and the accessibility tree. Project links are view-only, so a
 * shared project stays read-only. Focus returns to the element that was
 * focused when the overlay opened.
 */
const ProjectShareOverlay: FC<Props> = ({ projectId, onClose }) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement as HTMLElement | null,
  );

  /* Portalled to the body, so the rest of the page is a sibling to make
     inert, and the fixed backdrop is not boxed in by a translated or clipping
     ancestor (the mobile sidebar drawer). Declared before the focus effect:
     cleanups run in order, so the page is interactive again before focus
     returns to it. */
  useEffect(() => {
    const backdrop = backdropRef.current;
    if (backdrop == null) return;
    return makeOutsideInert(backdrop);
  }, []);

  useEffect(() => {
    const returnFocus = returnFocusRef.current;
    return () => returnFocus?.focus();
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      ref={backdropRef}
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4"
    >
      <SharePopoverContainer
        itemId={projectId}
        canEditAccess={false}
        onClose={onClose}
      />
    </div>,
    document.body,
  );
};

export default memo(ProjectShareOverlay);
