import { FeatureType } from '@/src/types/common';
import { Theme } from '@/src/types/themes';

export interface UIState {
  initialized: boolean;
  theme: string;
  availableThemes: Theme[];
  showChatbar: boolean;
  showPromptbar: boolean;
  showMarketplaceFilterbar: boolean;
  isUserSettingsOpen: boolean;
  isProfileOpen: boolean;
  isCompareMode: boolean;
  openedFoldersIds: Record<FeatureType, string[]>;
  textOfClosedAnnouncement?: string | undefined;
  isChatFullWidth: boolean;
  showSelectToMigrateWindow: boolean;
  chatbarWidth?: number;
  promptbarWidth?: number;
  marketplaceFilterbarWidth?: number;
  customLogo?: string;
  collapsedSections: Record<FeatureType, string[]>;
  previousRoute?: string;
}
