import { OAuthProviderType } from 'next-auth/providers';

import { CustomVisualizer } from '@/src/types/custom-visualizers';
import { StorageType } from '@/src/types/storage';

import { Feature, UploadStatus } from '@epam/ai-dial-shared';

export interface SettingsState {
  appName: string;
  isOverlay: boolean;
  overlayConversationId?: string;
  isAuthDisabled: boolean;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  publicationFilters: string[];
  codeWarning: string;
  announcement: string;
  defaultModelId: string | undefined;
  overlayDefaultModelId?: string | undefined;
  defaultAssistantSubmodelId: string;
  defaultRecentModelsIds: string[];
  defaultRecentAddonsIds: string[];
  storageType: StorageType;
  themesHostDefined: boolean;
  isolatedModelId?: string;
  customRenderers?: CustomVisualizer[];
  isSignInInSameWindow?: boolean;
  allowVisualizerSendMessages?: boolean;
  topics: string[];
  codeEditorPythonVersions: string[];
  quickAppsHost?: string;
  quickAppsModel?: string;
  quickAppsSchemaId?: string;
  dialApiHost?: string;
  defaultSystemPrompt?: string;
  providerId: string | null;
  initialDataStatus?: UploadStatus;
  defaultAuthProvider?: OAuthProviderType | null;
  widgetsSchemaIds?: string[];
}
