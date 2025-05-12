import { FloatingOverlay } from '@floating-ui/react';

import { useScreenState } from '@/src/hooks/useScreenState';

import { getCommonPageProps } from '@/src/utils/server/get-common-page-props';

import { ScreenState } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { MigrationSelectors } from '@/src/store/migration/migration.selectors';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { SettingsState } from '@/src/store/settings/settings.types';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { getLayout } from '@/src/pages/_app';

import { ImportExportLoader } from '../components/Chatbar/ImportExportLoader';
import { AnnouncementsBanner } from '../components/Common/AnnouncementBanner';
import { Chat } from '@/src/components/Chat/Chat';
import { Migration } from '@/src/components/Chat/Migration/Migration';
import { MigrationFailedWindow } from '@/src/components/Chat/Migration/MigrationFailedModal';
import Header from '@/src/components/Header/Header';

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
  const isAnyMenuOpen = useAppSelector(UISelectors.selectIsAnyMenuOpen);
  const isIsolatedView = useAppSelector(SettingsSelectors.selectIsIsolatedView);

  const screenState = useScreenState();

  if (conversationsToMigrateCount !== 0 || promptsToMigrateCount !== 0) {
    if (
      conversationsToMigrateCount + promptsToMigrateCount ===
      migratedPromptsCount + migratedConversationsCount
    ) {
      return window.location.reload();
    }
  }

  const showFloatingOverlay =
    (screenState === ScreenState.SM || screenState === ScreenState.MD) &&
    isAnyMenuOpen &&
    !isIsolatedView;

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
            <div className="flex min-w-0 grow flex-col">
              {showFloatingOverlay && (
                <FloatingOverlay className="z-30 bg-blackout" />
              )}
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
