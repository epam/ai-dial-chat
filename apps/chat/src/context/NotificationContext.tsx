import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

export interface NotificationItem {
  id: string;
  variant: NotificationVariant;
  title?: string;
  message?: ReactNode;
  /**
   * Validated 32-hex W3C trace ID, shown as a "Request ID" under the
   * notification. Omitted for client-only/validation errors and any non-error
   * notification.
   */
  requestId?: string;
}

export type ShowNotificationOptions = Omit<NotificationItem, 'id'>;

interface NotificationContextType {
  notifications: NotificationItem[];
  showNotification: (options: ShowNotificationOptions) => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showNotification = useCallback((options: ShowNotificationOptions) => {
    const id = crypto.randomUUID();
    setNotifications((prev) => [...prev, { ...options, id }]);
  }, []);

  return (
    <NotificationContext.Provider
      value={useMemo(
        () => ({ notifications, showNotification, dismissNotification }),
        [notifications, showNotification, dismissNotification],
      )}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotification must be used within a NotificationProvider',
    );
  }
  return context;
};
