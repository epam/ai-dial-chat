import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import { ReportIssueDialog } from './ReportIssueDialog';
import { RequestAPIKeyDialog } from './RequestApiKeyDialog';

interface Props {
  isShowFooter: boolean;
  isShowRequestApiKey: boolean;
  isShowReportAnIssue: boolean;
}

export const FooterMessage = ({
  isShowFooter,
  isShowReportAnIssue,
  isShowRequestApiKey,
}: Props) => {
  const { t } = useTranslation('chat');
  const [isRequestAPIDialogOpen, setIsRequestAPIDialogOpen] = useState(false);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);

  return isShowFooter ? (
    <>
      <div className="px-3 pt-2 pb-3 text-center text-[12px] text-black/50 dark:text-white/50 md:px-4 md:pt-3 md:pb-6">
        <a
          href="https://kb.epam.com/display/EPMGPT/EPAM+AI+Chat"
          target="_blank"
          rel="noreferrer"
          className="underline font-bold"
        >
          EPAM AI Chat
        </a>{' '}
        can be used <span className="underline">any work-related activity</span>
        . Rest assured, information you share here is{' '}
        <span className="underline">
          not disclosed to third-party companies
        </span>
        . However, we <span className="underline">anonymize and log</span> all
        interactions for research purposes. <br />
        {isShowRequestApiKey ? (
          <>
            For API access please fill&nbsp;
            <a
              href=""
              onClick={(e) => {
                e.preventDefault();
                setIsRequestAPIDialogOpen(true);
              }}
              className="underline font-bold"
            >
              {t('this form')}
            </a>
            .&nbsp;
          </>
        ) : null}
        {isShowReportAnIssue ? (
          <>
            If you have a problem please&nbsp;
            <a
              href=""
              onClick={(e) => {
                e.preventDefault();
                setIsReportIssueDialogOpen(true);
              }}
              className="underline font-bold"
            >
              {t('report an issue')}
            </a>
            .
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
