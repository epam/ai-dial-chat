import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type {
  NotificationContextType,
  ShowVariantNotificationOptions,
} from '../NotificationContext';

/*
 * Builds the `useNotification()` value for tests. Every variant helper forwards to the
 * single `showNotification` spy with its variant applied — the same delegation the real
 * provider does — so assertions can keep matching on `{ variant, ... }` payloads.
 */
export const createNotificationContextValue = (
  showNotification: NotificationContextType['showNotification'],
  overrides: Partial<NotificationContextType> = {},
): NotificationContextType => {
  const withVariant =
    (variant: NotificationVariant) =>
    (options: ShowVariantNotificationOptions) =>
      showNotification({ ...options, variant });

  return {
    notifications: [],
    showNotification,
    showInfoNotification: withVariant(NotificationVariant.Info),
    showSuccessNotification: withVariant(NotificationVariant.Success),
    showWarningNotification: withVariant(NotificationVariant.Warning),
    showErrorNotification: withVariant(NotificationVariant.Error),
    showLoadingNotification: withVariant(NotificationVariant.Loading),
    dismissNotification: () => undefined,
    ...overrides,
  };
};
