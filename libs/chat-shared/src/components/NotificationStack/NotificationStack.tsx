import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
  LiveRegion,
  LiveRegionElement,
  Notification,
  type NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { copyToClipboard } from '../../utils/copy-to-clipboard';
import { mergeClasses } from '../../utils/merge-class';

/** One toast in a `NotificationStack`. */
export interface NotificationStackItem {
  /** Stable id, handed back to `onDismiss`. */
  id: string;
  /** Kit variant: icon, colour and live-region politeness. */
  variant: NotificationVariant;
  /** Optional heading above the message. */
  title?: string;
  /** Message body. */
  message?: ReactNode;
  /** Optional control at the toast's inline end; an action-bearing toast stays until dismissed. */
  action?: ReactNode;
  /** Trace id shown as a copyable "Request ID" row; a toast carrying one stays until dismissed. */
  requestId?: string;
}

/** User-visible strings of `NotificationStack`. */
export interface NotificationStackLabels {
  /** Label before the request id. Defaults to `'Request ID'`. */
  requestId?: string;
  /** Accessible name of the copy button. Defaults to `'Copy request ID'`. */
  copyRequestIdAriaLabel?: string;
  /** Announcement after a successful copy. Defaults to `'Request ID copied'`. */
  requestIdCopied?: string;
  /** Announcement after a failed copy. Defaults to `"Couldn't copy request ID"`. */
  requestIdCopyFailed?: string;
  /** Accessible name of each toast's close button. Defaults to `'Close notification'`. */
  close?: string;
}

/** Props for `NotificationStack`. */
export interface NotificationStackProps {
  /** Toasts in arrival order; the newest renders last. */
  items: readonly NotificationStackItem[];
  /** Called with a toast's id when it is closed or its dismiss delay ends. */
  onDismiss: (id: string) => void;
  /** User-visible strings, each with an English default. */
  labels?: NotificationStackLabels;
  /** Delay before a plain toast dismisses itself, in milliseconds. Defaults to `5000`. */
  dismissDelayMs?: number;
  /** Classes of the fixed stack, replacing the default bottom-edge (phone) / bottom-end corner (desktop) placement. */
  className?: string;
  /** CSS class applied to the request-id row. Defaults to `'dial-tiny-text'`. */
  requestIdClassName?: string;
}

const COPY_STATUS_RESET_MS = 2000;

/*
 * Phones: the stack spans the bottom edge minus a side gutter and each toast
 * takes the full width, so a toast can never be wider than the screen (the
 * kit only caps it at 600px). Desktop: the stack releases its inline-start
 * inset and pins to the bottom-end corner with a definite width. The empty
 * band between toasts stays click-through.
 */
const DEFAULT_STACK_CLASS_NAME =
  'pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-70 flex max-h-[calc(100dvh-3rem)] flex-col items-center gap-2 overflow-y-auto px-4 desktop:inset-s-auto desktop:me-6 desktop:w-[min(600px,calc(100vw-3rem))] desktop:items-end desktop:px-0';

enum CopyStatus {
  Idle = 'idle',
  Copied = 'copied',
  Failed = 'failed',
}

interface RequestIdRowProps {
  requestId: string;
  labels: Required<NotificationStackLabels>;
  className: string;
}

/* "Request ID" label + LTR-forced value + Copy control, under a toast's message. */
const RequestIdRow: FC<RequestIdRowProps> = ({
  requestId,
  labels,
  className,
}) => {
  const [copyStatus, setCopyStatus] = useState(CopyStatus.Idle);

  useEffect(() => {
    if (copyStatus === CopyStatus.Idle) return;
    const timer = window.setTimeout(
      () => setCopyStatus(CopyStatus.Idle),
      COPY_STATUS_RESET_MS,
    );
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const handleCopy = async () => {
    try {
      const isCopied = await copyToClipboard(requestId);
      setCopyStatus(isCopied ? CopyStatus.Copied : CopyStatus.Failed);
    } catch {
      setCopyStatus(CopyStatus.Failed);
    }
  };

  let statusText = '';
  if (copyStatus === CopyStatus.Copied) {
    statusText = labels.requestIdCopied;
  } else if (copyStatus === CopyStatus.Failed) {
    statusText = labels.requestIdCopyFailed;
  }

  return (
    <div
      className={mergeClasses(
        'mt-1 flex min-w-0 items-center gap-1',
        className,
      )}
    >
      <span className="text-start">{labels.requestId}:</span>
      <span dir="ltr" className="min-w-0 truncate">
        {requestId}
      </span>
      <GhostIconButton
        icon={
          <IconCopy
            size={DIAL_ICON_SIZE.SM}
            aria-hidden
            stroke={DIAL_KIT_ICON_STROKE}
          />
        }
        aria-label={labels.copyRequestIdAriaLabel}
        onClick={() => void handleCopy()}
      />
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {statusText}
      </LiveRegion>
    </div>
  );
};

interface NotificationEntryProps {
  item: NotificationStackItem;
  onDismiss: (id: string) => void;
  dismissDelayMs: number;
  labels: Required<NotificationStackLabels>;
  requestIdClassName: string;
}

const NotificationEntry: FC<NotificationEntryProps> = memo(
  ({ item, onDismiss, dismissDelayMs, labels, requestIdClassName }) => {
    /*
     * Trace-bearing and actionable toasts require manual dismissal, so the
     * request id stays copyable and the action reachable.
     */
    useEffect(() => {
      if (item.requestId || item.action) return;
      const timer = setTimeout(() => onDismiss(item.id), dismissDelayMs);
      return () => clearTimeout(timer);
    }, [item.id, item.requestId, item.action, onDismiss, dismissDelayMs]);

    /*
     * The kit caps a toast's width but not its height, so the message scrolls
     * instead of letting the toast cover the page; the request-id row stays
     * outside the scroll box. `wrap-anywhere` lets a long unbroken token wrap.
     */
    const composedMessage = useMemo(
      () => (
        <>
          <div className="max-h-[30vh] overflow-y-auto wrap-anywhere">
            {item.message}
          </div>
          {item.requestId && (
            <RequestIdRow
              requestId={item.requestId}
              labels={labels}
              className={requestIdClassName}
            />
          )}
        </>
      ),
      [item.message, item.requestId, labels, requestIdClassName],
    );

    return (
      <Notification
        className="pointer-events-auto w-full max-w-[min(600px,100%)] desktop:w-auto"
        variant={item.variant}
        title={item.title}
        message={composedMessage}
        action={item.action}
        closable
        closeAriaLabel={labels.close}
        onClose={() => onDismiss(item.id)}
      />
    );
  },
);

/** Portalled stack of toasts that auto-dismisses plain ones and keeps request-id and action toasts until closed. */
export const NotificationStack: FC<NotificationStackProps> = memo(
  ({
    items,
    onDismiss,
    labels,
    dismissDelayMs = 5000,
    className = DEFAULT_STACK_CLASS_NAME,
    requestIdClassName = 'dial-tiny-text',
  }) => {
    const stackRef = useRef<HTMLDivElement>(null);
    const prevIdsRef = useRef<ReadonlySet<string>>(new Set());
    const resolvedLabels = useMemo<Required<NotificationStackLabels>>(
      () => ({
        requestId: labels?.requestId ?? 'Request ID',
        copyRequestIdAriaLabel:
          labels?.copyRequestIdAriaLabel ?? 'Copy request ID',
        requestIdCopied: labels?.requestIdCopied ?? 'Request ID copied',
        requestIdCopyFailed:
          labels?.requestIdCopyFailed ?? "Couldn't copy request ID",
        close: labels?.close ?? 'Close notification',
      }),
      [labels],
    );

    /*
     * Once the stack overflows, the newest toast (last in DOM) would sit below
     * the fold. Scroll to the end whenever a toast is added; ids are compared
     * rather than counts, so an add batched with a dismissal still scrolls.
     */
    useLayoutEffect(() => {
      const stack = stackRef.current;
      const prevIds = prevIdsRef.current;
      if (stack && items.some(({ id }) => !prevIds.has(id))) {
        stack.scrollTop = stack.scrollHeight;
      }
      prevIdsRef.current = new Set(items.map(({ id }) => id));
    }, [items]);

    if (!items.length) return null;

    return createPortal(
      <div ref={stackRef} className={className}>
        {items.map((item) => (
          <NotificationEntry
            key={item.id}
            item={item}
            onDismiss={onDismiss}
            dismissDelayMs={dismissDelayMs}
            labels={resolvedLabels}
            requestIdClassName={requestIdClassName}
          />
        ))}
      </div>,
      document.body,
    );
  },
);
