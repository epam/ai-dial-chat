import {
  generateUUID,
  type NotificationStackItem,
} from '@epam/ai-dial-chat-shared';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

/** A toast in the app's stack; the shape `NotificationStack` renders. */
export type NotificationItem = NotificationStackItem;

export type ShowNotificationOptions = Omit<NotificationItem, 'id'> & {
  /**
   * Caller-supplied notification id, for later dismissal. Defaults to a
   * generated one. Supply it when the caller must dismiss the notification
   * and builds the dismissal reference before the show call — e.g. an action
   * rendered inside the toast that dismisses its own notification.
   */
  id?: string;
};

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
) => string;

export interface NotificationContextType {
  notifications: NotificationItem[];
  /** Queues the notification and resolves its id, for later dismissal. */
  showNotification: (options: ShowNotificationOptions) => string;
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

  const showNotification = useCallback(
    (options: ShowNotificationOptions): string => {
      const id = options.id ?? generateUUID();
      setNotifications((prev) => [...prev, { ...options, id }]);
      return id;
    },
    [],
  );

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
