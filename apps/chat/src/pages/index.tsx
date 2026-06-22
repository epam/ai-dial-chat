import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { useAppSelector } from '@/src/store/hooks';
import {
  MigrationSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';
import { SettingsState } from '@/src/store/settings/settings.types';

import { getLayout } from '@/src/pages/_app';

import { Chat } from '@/src/components/Chat/Chat';
import { Migration } from '@/src/components/Chat/Migration/Migration';
import { MigrationFailedWindow } from '@/src/components/Chat/Migration/MigrationFailedModal';
import { ImportExportLoader } from '@/src/components/Chatbar/ImportExportLoader';
import { AnnouncementsBanner } from '@/src/components/Common/AnnouncementBanner';
import { FloatingPanelToggles } from '@/src/components/Header/FloatingPanelToggles';
import { Header } from '@/src/components/Header/Header';

import { useCustomizations } from '@/src/customizations';
import { Feature } from '@epam/ai-dial-shared';

export interface HomeProps {
  initialState: {
    settings: SettingsState;
  };
}

function Home() {
  useCustomizations();

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
    UISelectors.selectShowSelectToMigrateWindow,
  );

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
        <div className="relative flex size-full flex-col sm:pt-0">
          {enabledFeatures.has(Feature.Header) && <Header />}
          <FloatingPanelToggles />
          <div className="flex min-h-0 w-full flex-1 overflow-auto">
            <div className="flex size-full flex-col">
              <AnnouncementsBanner />
              <Chat />
              <ImportExportLoader />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

Home.getLayout = getLayout;

export default Home;

export const getServerSideProps = getCommonPageProps;
