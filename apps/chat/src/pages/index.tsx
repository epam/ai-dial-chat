import { useEffect } from 'react';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ImportExportSelectors } from '../store/import-export/importExport.reducers';
import { MigrationSelectors } from '../store/migration/migration.reducers';
import { ShareActions, ShareSelectors } from '../store/share/share.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  SettingsSelectors,
  SettingsState,
} from '@/src/store/settings/settings.reducers';
import {
  UISelectors,
  selectShowSelectToMigrateWindow,
} from '@/src/store/ui/ui.reducers';

import { SHARE_QUERY_PARAM } from '../constants/share';

import ShareModal from '../components/Chat/ShareModal';
import { ImportExportLoader } from '../components/Chatbar/ImportExportLoader';
import { AnnouncementsBanner } from '../components/Common/AnnouncementBanner';
import { ReplaceConfirmationModal } from '../components/Common/ReplaceConfirmationModal/ReplaceConfirmationModal';
import { Chat } from '@/src/components/Chat/Chat';
import { Migration } from '@/src/components/Chat/Migration/Migration';
import { MigrationFailedWindow } from '@/src/components/Chat/Migration/MigrationFailedModal';
import { Chatbar } from '@/src/components/Chatbar/Chatbar';
import Header from '@/src/components/Header/Header';
import { UserMobile } from '@/src/components/Header/User/UserMobile';
import Promptbar from '@/src/components/Promptbar';

import { useCustomizations } from '@/src/customizations';
import { Feature } from '@epam/ai-dial-shared';

export interface HomeProps {
  initialState: {
    settings: SettingsState;
  };
}

export default function Home() {
  useCustomizations();

  const dispatch = useAppDispatch();

  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);
  const isShareModalClosed = useAppSelector(
    ShareSelectors.selectShareModalClosed,
  );
  const enabledFeatures = useAppSelector(
    SettingsSelectors.selectEnabledFeatures,
  );
  const { conversationsToMigrateCount, migratedConversationsCount } =
    useAppSelector(
      MigrationSelectors.selectConversationsToMigrateAndMigratedCount,
    );
  const { promptsToMigrateCount, migratedPromptsCount } = useAppSelector(
    MigrationSelectors.selectPromptsToMigrateAndMigratedCount,
  );
  const failedMigratedConversations = useAppSelector(
    MigrationSelectors.selectFailedMigratedConversations,
  );
  const failedMigratedPrompts = useAppSelector(
    MigrationSelectors.selectFailedMigratedPrompts,
  );
  const showSelectToMigrateWindow = useAppSelector(
    selectShowSelectToMigrateWindow,
  );
  const isImportingExporting = useAppSelector(
    ImportExportSelectors.selectIsLoadingImportExport,
  );

  const isReplaceModalOpened = useAppSelector(
    ImportExportSelectors.selectIsShowReplaceDialog,
  );

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has(SHARE_QUERY_PARAM)) {
      dispatch(
        ShareActions.acceptShareInvitation({
          invitationId: searchParams.get(SHARE_QUERY_PARAM)!,
        }),
      );
    }
  }, [dispatch]);

  if (conversationsToMigrateCount !== 0 || promptsToMigrateCount !== 0) {
    if (
      conversationsToMigrateCount + promptsToMigrateCount ===
      migratedPromptsCount + migratedConversationsCount
    ) {
      return window.location.reload();
    }
  }

  return (
    <>
      {conversationsToMigrateCount + promptsToMigrateCount !==
      migratedPromptsCount + migratedConversationsCount ? (
        <Migration
          total={conversationsToMigrateCount + promptsToMigrateCount}
          uploaded={migratedPromptsCount + migratedConversationsCount}
        />
      ) : failedMigratedConversations.length ||
        failedMigratedPrompts.length ||
        showSelectToMigrateWindow ? (
        <MigrationFailedWindow
          showSelectToMigrateWindow={showSelectToMigrateWindow}
          failedMigratedConversations={failedMigratedConversations}
          failedMigratedPrompts={failedMigratedPrompts}
        />
      ) : (
        <div className="flex size-full flex-col sm:pt-0">
          {enabledFeatures.has(Feature.Header) && <Header />}
          <div className="flex w-full grow overflow-auto">
            {enabledFeatures.has(Feature.ConversationsSection) && <Chatbar />}

            <div className="flex min-w-0 grow flex-col">
              <AnnouncementsBanner />
              <Chat />

              {isImportingExporting && (
                <ImportExportLoader isOpen={isImportingExporting} />
              )}
            </div>
            {enabledFeatures.has(Feature.PromptsSection) && <Promptbar />}
            {isProfileOpen && <UserMobile />}
            {!isShareModalClosed && <ShareModal />}
            {isReplaceModalOpened && (
              <ReplaceConfirmationModal isOpen={isReplaceModalOpened} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

export const getServerSideProps = getCommonPageProps;
