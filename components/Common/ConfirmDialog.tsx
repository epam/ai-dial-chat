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
          className="z-50 flex items-center justify-center bg-gray-900/70 p-3 dark:bg-gray-900/30"
        >
          <FloatingFocusManager
            context={context}
            initialFocus={confirmLabelRef}
          >
            <div
              className="z-50 flex min-w-[90%] flex-col items-center gap-4 rounded bg-gray-100 p-6 text-center dark:bg-gray-700 md:min-w-[300px] md:max-w-[500px]"
              ref={refs.setFloating}
              aria-labelledby={headingId}
              aria-describedby={descriptionId}
              {...getFloatingProps()}
            >
              <div className="flex flex-col gap-2">
                <h2 id={headingId} className="text-base font-semibold">
                  {heading}
                </h2>
                {description && <p id={descriptionId}>{description}</p>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="rounded border border-gray-400 px-3 py-2.5 hover:bg-gray-400 dark:border-gray-600 hover:dark:bg-gray-600"
                  onClick={() => {
                    onClose(false);
                  }}
                >
                  {cancelLabel}
                </button>
                <button
                  ref={confirmLabelRef}
                  className="rounded bg-blue-500 px-3 py-2.5 text-gray-100 hover:bg-blue-700"
                  onClick={() => onClose(true)}
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
