import { useEffect, useState } from 'react';

import { useUrlHash } from '@/src/hooks/useUrlHash';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ReportIssueDialog } from '@/src/components/Chat/ReportIssueDialog';
import { RequestAPIKeyDialog } from '@/src/components/Chat/RequestApiKeyDialog';

import { Feature } from '@epam/ai-dial-shared';

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
          dangerouslySetInnerHTML={{ __html: footerHtmlMessage || '' }}
        ></span>
      </div>
      {enabledFeatures.has(Feature.RequestApiKey) && isRequestAPIDialogOpen && (
        <RequestAPIKeyDialog
          onClose={() => {
            setIsRequestAPIDialogOpen(false);
            window.location.hash = '';
            resetHash();
          }}
        />
      )}
      {enabledFeatures.has(Feature.ReportAnIssue) &&
        isReportIssueDialogOpen && (
          <ReportIssueDialog
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
