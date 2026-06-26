import { DialNotification } from '@epam/ai-dial-ui-kit';
import { memo, useEffect, type FC } from 'react';
import { createPortal } from 'react-dom';
import {
  useNotification,
  type NotificationItem,
} from '../../context/NotificationContext';

const DISMISS_DELAY_MS = 5000;

interface NotificationEntryProps {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}

const NotificationEntry: FC<NotificationEntryProps> = memo(
  ({ item, onDismiss }) => {
    useEffect(() => {
      const timer = setTimeout(() => onDismiss(item.id), DISMISS_DELAY_MS);
      return () => clearTimeout(timer);
    }, [item.id, onDismiss]);

    return (
      <DialNotification
        variant={item.variant}
        title={item.title}
        message={item.message}
        textClassName="flex-col min-w-0"
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
    <div className="fixed start-1/2 top-6 z-[70] flex -translate-x-1/2 flex-col gap-2">
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
