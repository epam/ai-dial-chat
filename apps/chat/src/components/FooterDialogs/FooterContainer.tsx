import type { FC } from 'react';
import { memo, useCallback, useState } from 'react';
import { useFeatureFlag } from '../../context/AppConfigContext';
import FooterMessage from '../FooterMessage/FooterMessage';
import ReportIssueDialog from './ReportIssueDialog';
import RequestApiKeyDialog from './RequestApiKeyDialog';

const FooterContainer: FC = () => {
  const isRequestApiKeyEnabled = useFeatureFlag('requestApiKey');
  const isReportIssueEnabled = useFeatureFlag('reportAnIssue');

  const [isRequestApiKeyOpen, setIsRequestApiKeyOpen] = useState(false);
  const [isReportIssueOpen, setIsReportIssueOpen] = useState(false);

  const handleDialAction = useCallback(
    (action: string) => {
      if (action === 'requestApiKey' && isRequestApiKeyEnabled) {
        setIsRequestApiKeyOpen(true);
      } else if (action === 'reportIssue' && isReportIssueEnabled) {
        setIsReportIssueOpen(true);
      }
    },
    [isRequestApiKeyEnabled, isReportIssueEnabled],
  );

  const handleRequestApiKeyClose = useCallback(() => {
    setIsRequestApiKeyOpen(false);
  }, []);

  const handleReportIssueClose = useCallback(() => {
    setIsReportIssueOpen(false);
  }, []);

  return (
    <>
      <FooterMessage onDialAction={handleDialAction} />
      {isRequestApiKeyEnabled && (
        <RequestApiKeyDialog
          isOpen={isRequestApiKeyOpen}
          onClose={handleRequestApiKeyClose}
        />
      )}
      {isReportIssueEnabled && (
        <ReportIssueDialog
          isOpen={isReportIssueOpen}
          onClose={handleReportIssueClose}
        />
      )}
    </>
  );
};

export default memo(FooterContainer);
