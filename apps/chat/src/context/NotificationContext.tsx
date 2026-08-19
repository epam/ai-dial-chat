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

/*
 * Payload of the variant-scoped helpers (`showErrorNotification` and friends):
 * same as `ShowNotificationOptions` minus the variant, which the helper supplies.
 */
export type ShowVariantNotificationOptions = Omit<
  ShowNotificationOptions,
  'variant'
>;

type ShowVariantNotification = (
  options: ShowVariantNotificationOptions,
) => void;

export interface NotificationContextType {
  notifications: NotificationItem[];
  showNotification: (options: ShowNotificationOptions) => void;
  showInfoNotification: ShowVariantNotification;
  showSuccessNotification: ShowVariantNotification;
  showWarningNotification: ShowVariantNotification;
  showErrorNotification: ShowVariantNotification;
  showLoadingNotification: ShowVariantNotification;
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

  const showInfoNotification = useCallback<ShowVariantNotification>(
    (options) =>
      showNotification({ ...options, variant: NotificationVariant.Info }),
    [showNotification],
  );

  const showSuccessNotification = useCallback<ShowVariantNotification>(
    (options) =>
      showNotification({ ...options, variant: NotificationVariant.Success }),
    [showNotification],
  );

  const showWarningNotification = useCallback<ShowVariantNotification>(
    (options) =>
      showNotification({ ...options, variant: NotificationVariant.Warning }),
    [showNotification],
  );

  const showErrorNotification = useCallback<ShowVariantNotification>(
    (options) =>
      showNotification({ ...options, variant: NotificationVariant.Error }),
    [showNotification],
  );

  const showLoadingNotification = useCallback<ShowVariantNotification>(
    (options) =>
      showNotification({ ...options, variant: NotificationVariant.Loading }),
    [showNotification],
  );

  return (
    <NotificationContext.Provider
      value={useMemo(
        () => ({
          notifications,
          showNotification,
          showInfoNotification,
          showSuccessNotification,
          showWarningNotification,
          showErrorNotification,
          showLoadingNotification,
          dismissNotification,
        }),
        [
          notifications,
          showNotification,
          showInfoNotification,
          showSuccessNotification,
          showWarningNotification,
          showErrorNotification,
          showLoadingNotification,
          dismissNotification,
        ],
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
