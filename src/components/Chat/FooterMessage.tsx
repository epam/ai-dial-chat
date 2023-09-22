import { useEffect, useState } from 'react';

import { useRouter } from 'next/router';

import { ReportIssueDialog } from './ReportIssueDialog';
import { RequestAPIKeyDialog } from './RequestApiKeyDialog';

interface Props {
  isShowFooter: boolean;
  isShowRequestApiKey: boolean;
  isShowReportAnIssue: boolean;
  footerHtmlMessage: string;
}

export const FooterMessage = ({
  isShowFooter,
  isShowReportAnIssue,
  isShowRequestApiKey,
  footerHtmlMessage,
}: Props) => {
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

  return isShowFooter ? (
    <>
      <div className="text-[12px] text-gray-500 md:text-center">
        <span
          dangerouslySetInnerHTML={{ __html: footerHtmlMessage || '' }}
        ></span>
      </div>

      {isShowRequestApiKey && (
        <RequestAPIKeyDialog
          isOpen={isRequestAPIDialogOpen}
          onClose={() => {
            setIsRequestAPIDialogOpen(false);
            router.replace(router.basePath);
          }}
        ></RequestAPIKeyDialog>
      )}

      {isShowReportAnIssue && (
        <ReportIssueDialog
          isOpen={isReportIssueDialogOpen}
          onClose={() => {
            setIsReportIssueDialogOpen(false);
            router.replace(router.basePath);
          }}
        ></ReportIssueDialog>
      )}
    </>
  ) : (
    <></>
  );
};
