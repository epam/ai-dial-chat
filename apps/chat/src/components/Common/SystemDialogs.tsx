import { useEffect, useState } from 'react';

import { useUrlHash } from '@/src/hooks/useUrlHash';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { reportAnIssueHash, requestApiKeyHash } from '@/src/constants/footer';

import { ReportIssueDialog } from '@/src/components/Chat/ReportIssueDialog';
import { RequestAPIKeyDialog } from '@/src/components/Chat/RequestApiKeyDialog';

import { Feature } from '@epam/ai-dial-shared';

export const SystemDialogs = () => {
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

  return (
    <>
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
    </>
  );
};
