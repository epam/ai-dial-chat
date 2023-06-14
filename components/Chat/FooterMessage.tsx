import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import { ReportIssueDialog } from './ReportIssueDialog';
import { RequestAPIKeyDialog } from './RequestApiKeyDialog';

interface Props {
  isShowFooter: boolean;
  isShowRequestApiKey: boolean;
  isShowReportAnIssue: boolean;
  footerHtmlMessage: string;
  requestApiKeyHtmlPreMessage: string;
  requestApiKeyHtmlLinkMessage: string;
  reportAnIssueHtmlPreMessage: string;
  reportAnIssueHtmlLinkMessage: string;
}

export const FooterMessage = ({
  isShowFooter,
  isShowReportAnIssue,
  isShowRequestApiKey,
  footerHtmlMessage,
  requestApiKeyHtmlPreMessage,
  requestApiKeyHtmlLinkMessage,
  reportAnIssueHtmlPreMessage,
  reportAnIssueHtmlLinkMessage,
}: Props) => {
  const { t } = useTranslation('chat');
  const [isRequestAPIDialogOpen, setIsRequestAPIDialogOpen] = useState(false);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);

  return isShowFooter ? (
    <>
      <div className="px-3 pt-2 pb-3 text-center text-[12px] text-black/50 dark:text-white/50 md:px-4 md:pt-3 md:pb-6">
        <span
          dangerouslySetInnerHTML={{ __html: footerHtmlMessage || '' }}
        ></span>
        {isShowRequestApiKey ? (
          <>
            <span
              dangerouslySetInnerHTML={{
                __html: requestApiKeyHtmlPreMessage || '',
              }}
            ></span>
            {requestApiKeyHtmlLinkMessage && (
              <a
                href=""
                onClick={(e) => {
                  e.preventDefault();
                  setIsRequestAPIDialogOpen(true);
                }}
              >
                <span
                  dangerouslySetInnerHTML={{
                    __html: requestApiKeyHtmlLinkMessage || '',
                  }}
                ></span>
              </a>
            )}
          </>
        ) : null}
        {isShowReportAnIssue ? (
          <>
            <span
              dangerouslySetInnerHTML={{
                __html: reportAnIssueHtmlPreMessage || '',
              }}
            ></span>
            {reportAnIssueHtmlPreMessage && (
              <a
                href=""
                onClick={(e) => {
                  e.preventDefault();
                  setIsReportIssueDialogOpen(true);
                }}
              >
                <span
                  dangerouslySetInnerHTML={{
                    __html: reportAnIssueHtmlLinkMessage || '',
                  }}
                ></span>
              </a>
            )}
          </>
        ) : null}
      </div>

      <RequestAPIKeyDialog
        isOpen={isRequestAPIDialogOpen}
        onClose={() => {
          setIsRequestAPIDialogOpen(false);
        }}
      ></RequestAPIKeyDialog>

      <ReportIssueDialog
        isOpen={isReportIssueDialogOpen}
        onClose={() => {
          setIsReportIssueDialogOpen(false);
        }}
      ></ReportIssueDialog>
    </>
  ) : (
    <></>
  );
};
