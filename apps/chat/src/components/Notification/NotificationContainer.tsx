import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
  Notification,
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
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { NotificationI18nKeys } from '../../constants/translation-keys';
import {
  useNotification,
  type NotificationItem,
} from '../../context/NotificationContext';

const DISMISS_DELAY_MS = 5000;
const COPY_STATUS_RESET_MS = 2000;

interface RequestIdRowProps {
  requestId: string;
}

/*
 * "Request ID" label + LTR-forced hex value + Copy control, rendered under a notification's
 * message when `item.requestId` is set.
 */
const RequestIdRow: FC<RequestIdRowProps> = ({ requestId }) => {
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  );

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(
      () => setCopyStatus('idle'),
      COPY_STATUS_RESET_MS,
    );
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(requestId);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  let statusText = '';
  if (copyStatus === 'copied') {
    statusText = t(NotificationI18nKeys.RequestIdCopiedStatus);
  } else if (copyStatus === 'failed') {
    statusText = t(NotificationI18nKeys.RequestIdCopyFailedStatus);
  }

  return (
    <div className="dial-tiny-text mt-1 flex min-w-0 items-center gap-1">
      <span className="text-start">
        {t(NotificationI18nKeys.RequestIdLabel)}:
      </span>
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
        aria-label={t(NotificationI18nKeys.RequestIdCopyAriaLabel)}
        onClick={() => void handleCopy()}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {statusText}
      </span>
    </div>
  );
};

interface NotificationEntryProps {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}

const NotificationEntry: FC<NotificationEntryProps> = memo(
  ({ item, onDismiss }) => {
    /*
     * Trace-bearing (`item.requestId` set) and actionable (`item.action` set) notifications
     * require manual dismissal, so their Request ID stays readable/copyable and their action
     * stays reachable instead of vanishing after the fixed delay.
     */
    useEffect(() => {
      if (item.requestId || item.action) return;
      const timer = setTimeout(() => onDismiss(item.id), DISMISS_DELAY_MS);
      return () => clearTimeout(timer);
    }, [item.id, item.requestId, item.action, onDismiss]);

    /*
     * The kit caps a toast's width at 600px but lets it grow to any height, so
     * a message listing many names used to cover the chat behind it. Scroll the
     * message instead of letting the toast grow; the Request ID row stays
     * outside so it cannot be scrolled out of reach. `overflow-wrap: anywhere`
     * lets a long unbroken token (an app name, a version) wrap instead of
     * forcing the toast wider than a phone screen.
     */
    const composedMessage = useMemo(
      () => (
        <>
          <div className="max-h-[30vh] overflow-y-auto wrap-anywhere">
            {item.message}
          </div>
          {item.requestId && <RequestIdRow requestId={item.requestId} />}
        </>
      ),
      [item.message, item.requestId],
    );

    return (
      <Notification
        className="pointer-events-auto w-full max-w-[min(600px,100%)] desktop:w-auto"
        variant={item.variant}
        title={item.title}
        message={composedMessage}
        action={item.action}
        closable
        onClose={() => onDismiss(item.id)}
      />
    );
  },
);

const NotificationContainer: FC = () => {
  const { notifications, dismissNotification } = useNotification();
  const stackRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  /*
   * A scroll box opens at its top, so once the bottom-anchored stack overflows
   * the newest toast (last in DOM) would sit below the fold. Scroll to the end
   * whenever a toast is added; a dismissal leaves the scroll position alone.
   */
  useLayoutEffect(() => {
    const stack = stackRef.current;
    if (stack && notifications.length > prevCountRef.current) {
      stack.scrollTop = stack.scrollHeight;
    }
    prevCountRef.current = notifications.length;
  }, [notifications.length]);

  if (!notifications.length) return null;

  /*
   * Phones: the stack spans the bottom edge minus a side gutter and each toast
   * takes the full width, so a toast can never be wider than the screen (the
   * kit only caps it at 600px). Desktop: the stack releases its inline-start
   * inset and pins to the bottom-end corner with a definite width — bottom-right
   * in LTR, bottom-left in RTL. Toasts keep arrival order, so the newest sits
   * nearest the bottom edge; the empty band between toasts stays click-through.
   * At z-70 the stack draws over the bottom-end TransferQueue panels (z-51);
   * the overlap is accepted because toasts are transient and closable.
   */
  return createPortal(
    <div
      ref={stackRef}
      className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-70 flex max-h-[calc(100dvh-3rem)] flex-col items-center gap-2 overflow-y-auto px-4 desktop:inset-s-auto desktop:me-6 desktop:w-[min(600px,calc(100vw-3rem))] desktop:items-end desktop:px-0"
    >
      {notifications.map((item) => (
        <NotificationEntry
          key={item.id}
          item={item}
          onDismiss={dismissNotification}
        />
      ))}
    </div>,
    document.body,
  );
};

export default memo(NotificationContainer);
