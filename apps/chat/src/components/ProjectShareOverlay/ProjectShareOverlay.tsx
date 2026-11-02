import { memo, useEffect, useRef, type FC, type MouseEvent } from 'react';
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
 * the same popover to its Share button; the project page opens it from the
 * ⋮ menu, which has closed by then, so it is centred on a backdrop instead.
 * Project links are view-only, so a shared project stays read-only. Focus
 * returns to the element that was focused when the overlay opened.
 */
const ProjectShareOverlay: FC<Props> = ({ projectId, onClose }) => {
  const returnFocusRef = useRef<HTMLElement | null>(
    document.activeElement as HTMLElement | null,
  );

  useEffect(() => {
    const returnFocus = returnFocusRef.current;
    return () => returnFocus?.focus();
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      role="presentation"
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4"
    >
      <SharePopoverContainer
        itemId={projectId}
        canEditAccess={false}
        onClose={onClose}
      />
    </div>
  );
};

export default memo(ProjectShareOverlay);
