import {
  DIAL_ICON_SIZE,
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
    <div className="mt-1 flex min-w-0 items-center gap-1 text-xs">
      <span className="text-start">
        {t(NotificationI18nKeys.RequestIdLabel)}:
      </span>
      <span dir="ltr" className="min-w-0 truncate">
        {requestId}
      </span>
      <GhostIconButton
        icon={<IconCopy size={DIAL_ICON_SIZE.SM} aria-hidden />}
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

    const composedMessage = useMemo(() => {
      if (!item.requestId) return item.message;
      return (
        <>
          {item.message}
          <RequestIdRow requestId={item.requestId} />
        </>
      );
    }, [item.message, item.requestId]);

    return (
      <Notification
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

  return createPortal(
    <div className="fixed left-1/2 top-6 z-[70] flex -translate-x-1/2 flex-col gap-2">
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
