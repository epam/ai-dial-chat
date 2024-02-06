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
  FormEvent,
  FormHTMLAttributes,
  KeyboardEventHandler,
  MouseEvent,
  MutableRefObject,
  ReactNode,
  useCallback,
} from 'react';

import classNames from 'classnames';

export interface Props extends FormHTMLAttributes<HTMLFormElement> {
  portalId: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode | ReactNode[];
  dataQa: string;
  initialFocus?: number | MutableRefObject<HTMLElement | null>;
  overlayClassName?: string;
  containerClassName: string;
  lockScroll?: boolean;
  hideClose?: boolean;
  onKeyDownOverlay?: KeyboardEventHandler<HTMLDivElement>;
  dismissProps?: UseDismissProps;
  form?: {
    noValidate: boolean;
    onSubmit: (e: FormEvent) => void;
  };
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
  hideClose = false,
  onKeyDownOverlay,
  dismissProps,
  form,
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

  const Tag = form ? 'form' : 'div';

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
            <Tag
              className={classNames(
                'relative max-h-full rounded bg-layer-3 text-left',
                containerClassName,
              )}
              role="dialog"
              ref={refs.setFloating}
              {...getFloatingProps()}
              data-qa={dataQa}
              {...(form && { ...form })}
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
            </Tag>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
}
