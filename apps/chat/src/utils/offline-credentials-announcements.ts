import {
  OfflineCredentialsLoginOutcomeType,
  OfflineCredentialsLogoutOutcomeType,
} from '@epam/ai-dial-chat-hooks';
import { ScheduledTasksI18nKeys } from '../constants/translation-keys';

/**
 * Polite live-region key for each terminal login outcome — announced
 * identically by every consumer surface (the Scheduled Tasks login banner and
 * the Settings → Extensions tab).
 */
export const OFFLINE_CREDENTIALS_LOGIN_ANNOUNCEMENT_KEYS: Record<
  OfflineCredentialsLoginOutcomeType,
  ScheduledTasksI18nKeys
> = {
  [OfflineCredentialsLoginOutcomeType.Success]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerSuccessAnnouncement,
  [OfflineCredentialsLoginOutcomeType.PopupBlocked]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerPopupBlockedMessage,
  [OfflineCredentialsLoginOutcomeType.Cancelled]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerCancelledMessage,
  [OfflineCredentialsLoginOutcomeType.TimedOut]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerTimeoutMessage,
  [OfflineCredentialsLoginOutcomeType.Failure]:
    ScheduledTasksI18nKeys.OfflineCredentialsBannerFailedMessage,
};

/**
 * Polite live-region key for a terminal logout outcome — the success
 * announcement only on a confirmed disconnection, the failure message
 * otherwise.
 */
export const getOfflineCredentialsLogoutAnnouncementKey = (
  outcome: OfflineCredentialsLogoutOutcomeType,
): ScheduledTasksI18nKeys =>
  outcome === OfflineCredentialsLogoutOutcomeType.Disconnected
    ? ScheduledTasksI18nKeys.DisconnectSuccessAnnouncement
    : ScheduledTasksI18nKeys.DisconnectFailedMessage;
