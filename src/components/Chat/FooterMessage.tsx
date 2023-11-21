import { useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ReportIssueDialog } from '@/src/components/Chat/ReportIssueDialog';
import { RequestAPIKeyDialog } from '@/src/components/Chat/RequestApiKeyDialog';

export const requestApiKeyHash = '#requestApiKey';
export const reportAnIssueHash = '#reportAnIssue';

export const FooterMessage = () => {
  const footerHtmlMessage = useAppSelector(
    SettingsSelectors.selectFooterHtmlMessage,
  );

  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const [isRequestAPIDialogOpen, setIsRequestAPIDialogOpen] = useState(false);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;

      if (hash === requestApiKeyHash) {
        setIsRequestAPIDialogOpen(true);
      }
      if (hash === reportAnIssueHash) {
        setIsReportIssueDialogOpen(true);
      }
    };
    handleHash();

    window.addEventListener('hashchange', handleHash);

    return () => {
      window.removeEventListener('hashchange', handleHash);
    };
  }, []);

  return enabledFeatures.has('footer') ? (
    <div data-qa="footer-message">
      <div className="text-[12px] text-gray-500 md:text-center">
        <span
          dangerouslySetInnerHTML={{ __html: footerHtmlMessage || '' }}
        ></span>
      </div>

      {enabledFeatures.has('request-api-key') && (
        <RequestAPIKeyDialog
          isOpen={isRequestAPIDialogOpen}
          onClose={() => {
            setIsRequestAPIDialogOpen(false);
            router.replace(router.basePath);
          }}
        ></RequestAPIKeyDialog>
      )}

      {enabledFeatures.has('report-an-issue') && (
        <ReportIssueDialog
          isOpen={isReportIssueDialogOpen}
          onClose={() => {
            setIsReportIssueDialogOpen(false);
            router.replace(router.basePath);
          }}
        ></ReportIssueDialog>
      )}
    </div>
  ) : null;
};
