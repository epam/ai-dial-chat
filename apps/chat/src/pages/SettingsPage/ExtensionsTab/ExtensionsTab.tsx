import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Button,
  ButtonAppearance,
  ButtonVariant,
  ConfirmationPopup,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Spinner,
} from '@epam/ai-dial-ui-kit';
import { IconLogin, IconLogout } from '@tabler/icons-react';
import { memo, useCallback, useState, type FC, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  ExtensionsI18nKeys,
  ScheduledTasksI18nKeys,
  SettingsI18nKeys,
} from '../../../constants/translation-keys';
import { useOfflineCredentialsAuth } from '../../../hooks/offlineCredentials/useOfflineCredentialsAuth';
import {
  OfflineCredentialsGateStatus,
  useOfflineCredentialsGate,
} from '../../../hooks/offlineCredentials/useOfflineCredentialsGate';
import ExtensionServiceRow, {
  EXTENSIONS_GRID_COLUMNS,
} from './../../../components/ExtensionServiceRow/ExtensionServiceRow';
import styles from './ExtensionsTab.module.scss';

const ExtensionsTab: FC = () => {
  const { t } = useTranslation();
  const {
    status,
    connect,
    connected,
    refetch: refetchCredentials,
  } = useOfflineCredentialsGate();
  const { isLoggingIn, liveAnnouncement, isLoggingOut, logIn, logOut } =
    useOfflineCredentialsAuth({
      connect,
      refetch: refetchCredentials,
    });

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
   * The shared auth flow's `logOut` resolves whether a fresh status refetch
   * confirmed the disconnection; the dialog itself — its open state and its
   * failure presentation — stays local to the tab.
   */
  const handleLogoutConfirm = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLogoutFailed(false);
    const isDisconnected = await logOut();
    if (isDisconnected) {
      setIsLogoutDialogOpen(false);
    } else {
      setIsLogoutFailed(true);
    }
  }, [isLoggingOut, logOut]);

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

  const isServiceRowVisible =
    status === OfflineCredentialsGateStatus.Hidden ||
    status === OfflineCredentialsGateStatus.Available;

  /* The row is the fixed Dial native service — its name is the localized
   * default, never derived from the OAuth client id Core happens to report
   * for the connected grant. */
  const serviceDisplayName = t(ExtensionsI18nKeys.ServiceDefaultName);

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
          <div
            role="table"
            aria-label={t(SettingsI18nKeys.Extensions)}
            className="overflow-hidden rounded-xl bg-layer-raised shadow-md"
          >
            <div
              role="row"
              className={mergeClasses(
                'hidden gap-4 px-6 py-3 desktop:grid desktop:items-center',
                EXTENSIONS_GRID_COLUMNS,
                styles.headerRow,
              )}
            >
              <span
                role="columnheader"
                className="dial-caption-lead-semi-text text-start text-secondary"
              >
                {t(ExtensionsI18nKeys.NameColumnLabel)}
              </span>
              <span
                role="columnheader"
                className="dial-caption-lead-semi-text text-start text-secondary"
              >
                {t(ExtensionsI18nKeys.DescriptionColumnLabel)}
              </span>
              {/* Visually empty per the design; the sr-only label keeps the
                  header announced for screen-reader users browsing the header row. */}
              <span role="columnheader">
                <span className="sr-only">
                  {t(ExtensionsI18nKeys.ActionsColumnLabel)}
                </span>
              </span>
            </div>
            <div role="rowgroup">
              {isServiceRowVisible && (
                <ExtensionServiceRow
                  displayName={serviceDisplayName}
                  description={t(ExtensionsI18nKeys.ServiceDescription)}
                  isWarningVisible={
                    status === OfflineCredentialsGateStatus.Available
                  }
                  authorizeLabel={t(ExtensionsI18nKeys.ServiceAuthorizeTooltip)}
                  action={resolveAction()}
                />
              )}
            </div>
          </div>
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
