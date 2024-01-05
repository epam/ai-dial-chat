import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  UseDismissProps,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { IconX } from '@tabler/icons-react';
import {
  FormHTMLAttributes,
  KeyboardEventHandler,
  MouseEvent,
  ReactNode,
  useCallback,
} from 'react';

import classNames from 'classnames';

interface Props extends FormHTMLAttributes<HTMLFormElement> {
  portalId: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode | ReactNode[];
  dataQa: string;
  initialFocus?: number | React.MutableRefObject<HTMLElement | null>;
  overlayClassName?: string;
  containerClassName: string;
  lockScroll?: boolean;
  hideClose?: boolean;
  onKeyDownOverlay?: KeyboardEventHandler<HTMLDivElement>;
  dismissProps?: UseDismissProps;
}

export default function Modal({
  portalId,
  isOpen,
  onClose,
  children,
  dataQa,
  initialFocus,
  overlayClassName,
  containerClassName,
  lockScroll = true,
  noValidate = true,
  hideClose = false,
  onKeyDownOverlay,
  dismissProps,
}: Props) {
  const { refs, context } = useFloating({
    open: isOpen,
    onOpenChange: onClose,
  });
  const role = useRole(context);
  const dismiss = useDismiss(context, dismissProps);
  const { getFloatingProps } = useInteractions([role, dismiss]);

  const handleClose = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      onClose();
    },
    [onClose],
  );

  return (
    <FloatingPortal id={portalId}>
      {isOpen && (
        <FloatingOverlay
          lockScroll={lockScroll}
          className={classNames(
            'z-50 flex items-center justify-center bg-blackout p-3 md:p-5',
            overlayClassName,
          )}
          data-floating-overlay
          onKeyDown={onKeyDownOverlay}
        >
          <FloatingFocusManager context={context} initialFocus={initialFocus}>
            <form
              onSubmit={(e) => e.preventDefault()}
              noValidate={noValidate}
              className={classNames(
                'relative max-h-full rounded bg-layer-3 text-left',
                containerClassName,
              )}
              role="dialog"
              ref={refs.setFloating}
              {...getFloatingProps()}
              data-qa={dataQa}
            >
              {!hideClose && (
                <button
                  type="button"
                  role="button"
                  className="absolute right-2 top-2 rounded text-secondary hover:text-accent-primary"
                  onClick={handleClose}
                >
                  <IconX height={24} width={24} />
                </button>
              )}

              {children}
            </form>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
}
