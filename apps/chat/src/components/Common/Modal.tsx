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

import { ModalState } from '@/src/types/modal';

import { Spinner } from './Spinner';
import Tooltip from './Tooltip';

export interface Props extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode | ReactNode[];
  portalId: string;
  state?: ModalState | boolean;
  heading?: string | ReactNode;
  headingClassName?: string;
  dataQa: string;
  initialFocus?: number | MutableRefObject<HTMLElement | null>;
  overlayClassName?: string;
  containerClassName: string;
  lockScroll?: boolean;
  hideClose?: boolean;
  dismissProps?: UseDismissProps;
  form?: {
    noValidate: boolean;
    onSubmit: (e: FormEvent) => void;
  };
  onClose: () => void;
  onKeyDownOverlay?: KeyboardEventHandler<HTMLDivElement>;
}

function ModalView({
  portalId,
  state = ModalState.CLOSED,
  heading,
  headingClassName,
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
    open: state !== ModalState.CLOSED && !!state,
    onOpenChange: onClose,
  });
  const role = useRole(context);
  const dismiss = useDismiss(context, { outsidePress: false, ...dismissProps });
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
      {state !== ModalState.CLOSED && (
        <FloatingOverlay
          lockScroll={lockScroll}
          className={classNames(
            'z-50 flex items-center justify-center bg-blackout p-3 md:p-5',
            overlayClassName,
          )}
          data-floating-overlay
          onKeyDown={onKeyDownOverlay}
        >
          <FloatingFocusManager
            context={context}
            {...(initialFocus && { initialFocus: initialFocus })}
          >
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
              {heading && typeof heading === 'string' ? (
                <h4
                  className={classNames(
                    'mb-2 max-h-[50px] whitespace-pre-wrap text-left text-base font-semibold',
                    headingClassName,
                  )}
                >
                  <Tooltip
                    contentClassName="max-w-[400px] break-words"
                    tooltip={heading}
                  >
                    <div
                      className="line-clamp-2 w-full break-words"
                      data-qa="modal-entity-name"
                    >
                      {heading}
                    </div>
                  </Tooltip>
                </h4>
              ) : (
                heading
              )}

              {state === ModalState.LOADING ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <Spinner size={60} />
                </div>
              ) : (
                children
              )}
            </Tag>
          </FloatingFocusManager>
        </FloatingOverlay>
      )}
    </FloatingPortal>
  );
}

export function Modal(props: Props) {
  if (props.state === ModalState.CLOSED) {
    return null;
  }

  return <ModalView {...props} />;
}
