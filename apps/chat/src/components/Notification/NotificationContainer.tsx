import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
  Notification,
} from '@epam/ai-dial-ui-kit';
import { IconCopy } from '@tabler/icons-react';
import { memo, useEffect, useMemo, useState, type FC } from 'react';
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
     * Trace-bearing error notifications (`item.requestId` set) require manual dismissal, so
     * their Request ID stays readable/copyable instead of vanishing after the fixed delay.
     */
    useEffect(() => {
      if (item.requestId) return;
      const timer = setTimeout(() => onDismiss(item.id), DISMISS_DELAY_MS);
      return () => clearTimeout(timer);
    }, [item.id, item.requestId, onDismiss]);

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
          <div className="max-h-[30vh] overflow-y-auto [overflow-wrap:anywhere]">
            {item.message}
          </div>
          {item.requestId && <RequestIdRow requestId={item.requestId} />}
        </>
      ),
      [item.message, item.requestId],
    );

    return (
      <Notification
        className="pointer-events-auto max-w-[min(600px,100%)]"
        variant={item.variant}
        title={item.title}
        message={composedMessage}
        closable
        onClose={() => onDismiss(item.id)}
      />
    );
  },
);

const NotificationContainer: FC = () => {
  const { notifications, dismissNotification } = useNotification();

  if (!notifications.length) return null;

  /*
   * The stack spans the viewport minus a side gutter and centers each toast,
   * so a toast can never be wider than the screen (the kit only caps it at
   * 600px, which clipped both edges on phones). The empty band between toasts
   * stays click-through. The stack scrolls once enough toasts pile up to reach
   * the bottom of the viewport, so the last one is never pushed off-screen.
   */
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[70] flex max-h-[calc(100dvh-3rem)] flex-col items-center gap-2 overflow-y-auto px-4">
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
