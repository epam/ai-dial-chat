import {
  OfflineCredentialsGateStatus,
  OfflineCredentialsLogoutOutcomeType,
} from '@epam/ai-dial-chat-hooks';
import {
  ExtensionsSection,
  type ExtensionServiceItem,
} from '@epam/ai-dial-settings-panel';
import {
  AVATAR_PALETTE,
  AvatarColor,
  Button,
  ButtonAppearance,
  ButtonVariant,
  ConfirmationPopup,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconLogin, IconLogout } from '@tabler/icons-react';
import {
  memo,
  useCallback,
  useEffect,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ExtensionsI18nKeys,
  ScheduledTasksI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import { useOfflineCredentialsAuth } from '../../../hooks/offlineCredentials/useOfflineCredentialsAuth';
import { useOfflineCredentialsGate } from '../../../hooks/offlineCredentials/useOfflineCredentialsGate';
import {
  getOfflineCredentialsLogoutAnnouncementKey,
  OFFLINE_CREDENTIALS_LOGIN_ANNOUNCEMENT_KEYS,
} from '../../../utils/offline-credentials-announcements';
import { isSchedulerConsentMissing } from '../../../utils/scheduler-consent';

const ExtensionsTab: FC = () => {
  const { t } = useTranslation();
  const {
    status,
    connect,
    connected,
    schedulerServiceConsent,
    refetch: refetchCredentials,
  } = useOfflineCredentialsGate();
  const { isLoggingIn, loginOutcome, isLoggingOut, logIn, logOut } =
    useOfflineCredentialsAuth({
      connect,
      refetch: refetchCredentials,
    });

  /*
   * The shared auth hook is outcome-based (the lib holds no i18n), so the tab
   * maps the terminal login outcome onto its polite announcement text; a new
   * attempt resets the outcome, and the announcement with it.
   */
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  useEffect(() => {
    setLiveAnnouncement(
      loginOutcome != null
        ? t(OFFLINE_CREDENTIALS_LOGIN_ANNOUNCEMENT_KEYS[loginOutcome])
        : '',
    );
  }, [loginOutcome, t]);

  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isLogoutFailed, setIsLogoutFailed] = useState(false);

  const handleLogoutClick = useCallback(() => {
    setIsLogoutFailed(false);
    setIsLogoutDialogOpen(true);
  }, []);

  const handleLogoutDialogClose = useCallback(() => {
    if (isLoggingOut) return;
    setIsLogoutDialogOpen(false);
    setIsLogoutFailed(false);
  }, [isLoggingOut]);

  /*
   * The shared auth flow's `logOut` resolves the outcome of the revoke; the
   * dialog itself — its open state and its failure presentation — stays
   * local to the tab, and the tab maps the outcome onto the announcement
   * text itself.
   */
  const handleLogoutConfirm = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLogoutFailed(false);
    const outcome = await logOut();
    setLiveAnnouncement(t(getOfflineCredentialsLogoutAnnouncementKey(outcome)));
    if (outcome === OfflineCredentialsLogoutOutcomeType.Disconnected) {
      setIsLogoutDialogOpen(false);
    } else {
      setIsLogoutFailed(true);
    }
  }, [isLoggingOut, logOut, t]);

  /*
   * Aria-table semantics: an empty action cell is legitimate (the state is
   * not yet resolved), so the cell always renders and only its content
   * switches — no layout shift between states.
   */
  const resolveAction = (): ReactNode => {
    if (
      status === OfflineCredentialsGateStatus.Checking ||
      status === OfflineCredentialsGateStatus.Unavailable ||
      status === OfflineCredentialsGateStatus.Error
    ) {
      return null;
    }
    if (connected) {
      return (
        /* Danger outlined per the design reference: a destructive action
           (revoke the stored grant) that should not read as the tab's primary
           control. */
        <Button
          label={t(ButtonsI18nKeys.LogOut)}
          variant={ButtonVariant.Danger}
          appearance={ButtonAppearance.Outlined}
          iconBefore={
            <IconLogout
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          onClick={handleLogoutClick}
        />
      );
    }
    if (connect != null) {
      return (
        <Button
          variant={ButtonVariant.Neutral}
          label={
            isLoggingIn
              ? t(ScheduledTasksI18nKeys.OfflineCredentialsBannerLoggingInLabel)
              : t(ButtonsI18nKeys.LogIn)
          }
          iconBefore={
            <IconLogin
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          disabled={isLoggingIn}
          onClick={logIn}
        />
      );
    }
    return null;
  };

  /*
   * Consent is evaluated before the login state: with the scheduler
   * service consent missing, neither logging in nor logging out can restore
   * it, so the red limited-access badge replaces the action regardless of
   * the connection state, and the avatar's warning glyph renders without a
   * tooltip (its state is carried by the badge's own text). `unknown` (a
   * failed consent read) fails open — the login-state branch decides.
   */
  const isLimitedAccess = isSchedulerConsentMissing(schedulerServiceConsent);

  const isServiceRowVisible =
    status === OfflineCredentialsGateStatus.Hidden ||
    status === OfflineCredentialsGateStatus.Available;

  /* The row is the fixed Dial native service — its name is the localized
   * default, never derived from the OAuth client id Core happens to report
   * for the connected grant. */
  const serviceDisplayName = t(ExtensionsI18nKeys.ServiceDefaultName);

  /* The presentational table shell (header row, column grid, dividers) is
   * `ExtensionsSection` from `@epam/ai-dial-settings-panel`; this tab owns
   * only the state that decides which row and which action render. */
  const serviceRows: ExtensionServiceItem[] = isServiceRowVisible
    ? [
        {
          id: 'dial-native',
          displayName: serviceDisplayName,
          /* Pinned per the design reference so the fixed Dial native service
           * keeps one colour regardless of the localized display name. */
          avatarColor: AVATAR_PALETTE[AvatarColor.Violet1],
          description: t(ExtensionsI18nKeys.ServiceDescription),
          isWarningVisible:
            isLimitedAccess ||
            status === OfflineCredentialsGateStatus.Available,
          limitedAccessLabel: isLimitedAccess
            ? t(ExtensionsI18nKeys.ServiceLimitedAccessLabel)
            : undefined,
          limitedAccessTooltipTitle: isLimitedAccess
            ? t(ExtensionsI18nKeys.ServiceLimitedAccessTooltipTitle)
            : undefined,
          limitedAccessTooltipDescription: isLimitedAccess
            ? t(ExtensionsI18nKeys.ServiceLimitedAccessTooltipDescription)
            : undefined,
          /* While the consent is missing the row renders the red
           * limited-access badge instead of any Log in/Log out action. */
          action: isLimitedAccess ? null : resolveAction(),
        },
      ]
    : [];

  return (
    <div className="flex size-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 px-8 py-3">
        <h2 className="dial-h1-text m-0 text-primary">
          {t(SettingsI18nKeys.Extensions)}
        </h2>
        <p className="dial-small-text m-0 text-secondary">
          {t(ExtensionsI18nKeys.Description)}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-4">
        {status === OfflineCredentialsGateStatus.Checking ? (
          <Spinner fullWidth={false} ariaLabel={t(BasicI18nKeys.Loading)} />
        ) : (
          <ExtensionsSection
            rows={serviceRows}
            labels={{
              tableAriaLabel: t(SettingsI18nKeys.Extensions),
              nameColumnLabel: t(ExtensionsI18nKeys.NameColumnLabel),
              descriptionColumnLabel: t(
                ExtensionsI18nKeys.DescriptionColumnLabel,
              ),
              actionsColumnLabel: t(ExtensionsI18nKeys.ActionsColumnLabel),
            }}
          />
        )}
      </div>

      {/*
       * Custom footer because the design wants a primary ghost Cancel and a
       * danger solid Log out (red background, white text), and the popup's
       * built-in footer hardcodes a neutral Cancel and a variant-driven
       * confirm. The row mirrors the kit's own default actions row so spacing
       * and the top rule stay identical. `isLoading` still swaps the body for
       * the loader; the footer drops out for the same interval. `hideClose`
       * replicates the built-in footer's rule of showing the header close
       * control only while in flight.
       */}
      <ConfirmationPopup
        open={isLogoutDialogOpen}
        header={t(ScheduledTasksI18nKeys.DisconnectConfirmTitle)}
        description={
          /* Two stacked paragraphs with the design's 8px gap, each at the
           * 16px `dial-body-paragraph-text` step — on the content itself,
           * because the popup's description container carries the 14px
           * `dial-small-paragraph-text` base whose stylesheet rule wins over
           * a body class merged onto the container. */
          isLogoutFailed ? (
            <p className="dial-body-paragraph-text">
              {t(ScheduledTasksI18nKeys.DisconnectFailedMessage)}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="dial-body-paragraph-text">
                {t(ScheduledTasksI18nKeys.DisconnectConfirmDescription)}
              </p>
              <p className="dial-body-paragraph-text">
                {t(
                  ScheduledTasksI18nKeys.DisconnectConfirmDescriptionSecondary,
                )}
              </p>
            </div>
          )
        }
        isLoading={isLoggingOut}
        hideClose={!isLoggingOut}
        footer={
          isLoggingOut ? null : (
            <div className="flex justify-end gap-2 border-t border-tertiary px-6 py-4">
              <Button
                variant={ButtonVariant.Primary}
                appearance={ButtonAppearance.Ghost}
                label={t(ButtonsI18nKeys.Cancel)}
                onClick={handleLogoutDialogClose}
              />
              <Button
                variant={ButtonVariant.Danger}
                appearance={ButtonAppearance.Solid}
                label={t(ButtonsI18nKeys.LogOut)}
                iconBefore={
                  <IconLogout
                    size={DIAL_ICON_SIZE.SM}
                    aria-hidden
                    stroke={DIAL_KIT_ICON_STROKE}
                  />
                }
                onClick={handleLogoutConfirm}
              />
            </div>
          )
        }
        onConfirm={handleLogoutConfirm}
        onClose={handleLogoutDialogClose}
      />

      <span role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </span>
    </div>
  );
};

export default memo(ExtensionsTab);
