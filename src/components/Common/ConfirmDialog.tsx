import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { useId, useRef } from 'react';

interface Props {
  isOpen: boolean;
  heading: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  onClose: (result: boolean) => void;
}

export const ConfirmDialog = ({
  heading,
  description,
  confirmLabel,
  cancelLabel,
  isOpen,
  onClose,
}: Props) => {
  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: onClose,
  });
  const confirmLabelRef = useRef<HTMLButtonElement>(null);

  const role = useRole(context);
  const dismiss = useDismiss(context, { outsidePressEvent: 'mousedown' });

  const { getFloatingProps } = useInteractions([role, dismiss]);

  const headingId = useId();
  const descriptionId = useId();

  return (
    <FloatingPortal id="theme-main">
      {isOpen && (
        <FloatingOverlay
          lockScroll
          className="bg-gray-900/70 z-50 flex items-center justify-center p-3"
        >
          <FloatingFocusManager
            context={context}
            initialFocus={confirmLabelRef}
          >
            <div
              className="bg-gray-100 z-50 flex min-w-[90%] flex-col items-center gap-4 rounded p-6 text-center md:min-w-[300px] md:max-w-[500px]"
              ref={refs.setFloating}
              aria-labelledby={headingId}
              aria-describedby={descriptionId}
              {...getFloatingProps()}
              data-qa="confirmation-dialog"
            >
              <div className="flex flex-col gap-2">
                <h2 id={headingId} className="text-base font-semibold">
                  {heading}
                </h2>
                {description && (
                  <p id={descriptionId} data-qa="confirm-message">
                    {description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="border-gray-400 rounded border px-3 py-2.5 hover:bg-layer-4"
                  onClick={() => {
                    onClose(false);
                  }}
                  data-qa="cancel-dialog"
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmLabelRef}
                  className="bg-blue-500 text-gray-100 hover:bg-blue-700 rounded px-3 py-2.5"
                  onClick={() => onClose(true)}
                  data-qa="confirm"
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
};
