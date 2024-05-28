import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { useUrlHash } from '@/src/hooks/useUrlHash';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { CHINA_TIME_ZONE_OFFSET } from '@/src/constants/chat';

import { ReportIssueDialog } from '@/src/components/Chat/ReportIssueDialog';
import { RequestAPIKeyDialog } from '@/src/components/Chat/RequestApiKeyDialog';

import { Feature } from '@epam/ai-dial-shared';

export const requestApiKeyHash = '#requestApiKey';
export const reportAnIssueHash = '#reportAnIssue';

export const FooterMessage = () => {
  const { t } = useTranslation(Translation.Common);
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const timeZoneOffset = useAppSelector(UISelectors.selectTimeZoneOffset);
  const isChinaLocation = timeZoneOffset === CHINA_TIME_ZONE_OFFSET;

  const [isRequestAPIDialogOpen, setIsRequestAPIDialogOpen] = useState(false);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const { hash, resetHash } = useUrlHash();

  useEffect(() => {
    if (hash === requestApiKeyHash) {
      setIsReportIssueDialogOpen(false);
      setIsRequestAPIDialogOpen(true);
    } else if (hash === reportAnIssueHash) {
      setIsRequestAPIDialogOpen(false);
      setIsReportIssueDialogOpen(true);
    }
  }, [hash]);

  return enabledFeatures.has(Feature.Footer) ? (
    <div data-qa="footer-message">
      <div className="text-[12px] text-secondary md:text-center">
        <span
          dangerouslySetInnerHTML={{
            //temporary solution, need to investigate issue with changing language
            // @ts-expect-error-next-line
            __html: isChinaLocation ? t('footer_msg_zh') : t('footer_msg_en'),
          }}
        />
      </div>
      {enabledFeatures.has(Feature.RequestApiKey) && (
        <RequestAPIKeyDialog
          isOpen={isRequestAPIDialogOpen}
          onClose={() => {
            setIsRequestAPIDialogOpen(false);
            window.location.hash = '';
            resetHash();
          }}
        />
      )}
      {enabledFeatures.has(Feature.ReportAnIssue) && (
        <ReportIssueDialog
          isOpen={isReportIssueDialogOpen}
          onClose={() => {
            setIsReportIssueDialogOpen(false);
            window.location.hash = '';
            resetHash();
          }}
        />
      )}
    </div>
  ) : null;
};
