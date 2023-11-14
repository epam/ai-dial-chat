import { useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ReportIssueDialog } from './ReportIssueDialog';
import { RequestAPIKeyDialog } from './RequestApiKeyDialog';

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
  const requestApiKeyHash = '#requestApiKey';
  const reportAnIssueHash = '#reportAnIssue';

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

  return enabledFeatures.includes('footer') ? (
    <>
      <div className="text-[12px] text-gray-500 md:text-center">
        <span
          dangerouslySetInnerHTML={{ __html: footerHtmlMessage || '' }}
        ></span>
      </div>

      {enabledFeatures.includes('request-api-key') && (
        <RequestAPIKeyDialog
          isOpen={isRequestAPIDialogOpen}
          onClose={() => {
            setIsRequestAPIDialogOpen(false);
            router.replace(router.basePath);
          }}
        ></RequestAPIKeyDialog>
      )}

      {enabledFeatures.includes('report-an-issue') && (
        <ReportIssueDialog
          isOpen={isReportIssueDialogOpen}
          onClose={() => {
            setIsReportIssueDialogOpen(false);
            router.replace(router.basePath);
          }}
        ></ReportIssueDialog>
      )}
    </>
  ) : null;
};
