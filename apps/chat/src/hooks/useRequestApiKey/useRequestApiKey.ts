import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterRequestApiKeyI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorDetails } from '../../server-api/api-error';
import type { RequestApiKeyPayload } from '../../server-api/footer.api';
import { submitRequestApiKey } from '../../server-api/footer.api';

interface UseRequestApiKeyResult {
  isLoading: boolean;
  submit: (payload: RequestApiKeyPayload) => Promise<boolean>;
}

export const useRequestApiKey = (): UseRequestApiKeyResult => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);

  const submit = useCallback(
    async (payload: RequestApiKeyPayload): Promise<boolean> => {
      setIsLoading(true);
      try {
        await submitRequestApiKey(payload);
        showNotification({
          variant: NotificationVariant.Success,
          title: t(FooterRequestApiKeyI18nKeys.SuccessTitle),
        });
        return true;
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        showNotification({
          variant: NotificationVariant.Error,
          title: t(FooterRequestApiKeyI18nKeys.ErrorTitle),
          requestId: traceId,
        });
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [showNotification, t],
  );

  return { isLoading, submit };
};
