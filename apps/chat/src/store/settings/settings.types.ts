import { OAuthProviderType } from 'next-auth/providers';

import {
  ApplicationVisualizers,
  CustomVisualizer,
} from '@/src/types/custom-visualizers';
import { StorageType } from '@/src/types/storage';

import { Feature, FeatureData, UploadStatus } from '@epam/ai-dial-shared';

export interface SettingsState {
  appName: string;
  isOverlay: boolean;
  overlayConversationId?: string;
  isAuthDisabled: boolean;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  enabledFeaturesData: Partial<Record<Feature, FeatureData>>;
  publicationFilters: string[];
  codeWarning: string;
  announcement: string;
  defaultModelReference: string | undefined;
  isOptimisticLoadEnabled: boolean;
  overlayDefaultModelReference?: string | undefined;
  defaultRecentModelsIds: string[];
  storageType: StorageType;
  themesHostDefined: boolean;
  isolatedModelId?: string;
  preselectedConversationId?: string;
  preselectedAction?: string;
  customRenderers?: CustomVisualizer[];
  applicationVisualizers?: ApplicationVisualizers;
  isSignInInSameWindow?: boolean;
  allowVisualizerSendMessages?: boolean;
  topics: string[];
  hiddenEntityTag?: string;
  codeEditorPythonVersions: string[];
  quickAppsHost?: string;
  quickAppsModel?: string;
  quickAppsSchemaId?: string;
  externalAppsSchemaId?: string;
  dialApiHost?: string;
  dialCoreExternalUrl?: string;
  defaultSystemPrompt?: string;
  asrModelId: string | null;
  audioTypesDefaultOrder: string[];
  providerId: string | null;
  initialDataStatus?: UploadStatus;
  defaultAuthProvider?: OAuthProviderType | null;
  widgetsSchemaIds?: string[];

  attachmentsSettings: {
    expandedTypes: string[];
    borderlessTypes: string[];
    withoutTitleTypes: string[];
  };
  stageContentLimit: number;
  resourceMaxSegmentBytes: number;
  availableLocales: string[];
}
