import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterReportIssueI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { getApiErrorDetails } from '../../server-api/api-error';
import type { ReportIssuePayload } from '../../server-api/footer.api';
import { submitReportIssue } from '../../server-api/footer.api';

interface UseReportIssueResult {
  isLoading: boolean;
  submit: (payload: ReportIssuePayload) => Promise<boolean>;
}

export const useReportIssue = (): UseReportIssueResult => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const [isLoading, setIsLoading] = useState(false);

  const submit = useCallback(
    async (payload: ReportIssuePayload): Promise<boolean> => {
      setIsLoading(true);
      try {
        await submitReportIssue(payload);
        showNotification({
          variant: NotificationVariant.Success,
          title: t(FooterReportIssueI18nKeys.SuccessTitle),
        });
        return true;
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        showNotification({
          variant: NotificationVariant.Error,
          title: t(FooterReportIssueI18nKeys.ErrorTitle),
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
