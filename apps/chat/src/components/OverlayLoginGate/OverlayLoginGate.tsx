import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { NeutralButton, PrimaryButton } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { OverlayExternalLoginStatus } from '../../hooks/auth/useOverlayExternalLogin';
import { useOverlayProviderLogin } from '../../hooks/auth/useOverlayProviderLogin';
import ProviderIcon from '../ProviderIcon/ProviderIcon';

const OverlayLoginGate: FC = () => {
  const { t } = useTranslation();
  const {
    hasProviderConfiguration,
    providers,
    isLoadingProviders,
    hasProviderError,
    retryLoadProviders,
    openProviderLogin,
    openLogin,
    externalLoginStatus,
  } = useOverlayProviderLogin();
  const isTakingLonger =
    externalLoginStatus === OverlayExternalLoginStatus.TakingLonger;
  const isInFlight =
    externalLoginStatus === OverlayExternalLoginStatus.Opening ||
    externalLoginStatus === OverlayExternalLoginStatus.Waiting ||
    isTakingLonger;
  const isLoginDisabled =
    externalLoginStatus === OverlayExternalLoginStatus.Opening;
  const isBlocked = externalLoginStatus === OverlayExternalLoginStatus.Blocked;
  const isProvidersErrorShown =
    hasProviderConfiguration && !isLoadingProviders && hasProviderError;
  const showSingleLogin =
    !hasProviderConfiguration ||
    (!isLoadingProviders &&
      !hasProviderError &&
      providers !== null &&
      providers.length === 0);

  return (
    <section
      aria-busy={isLoadingProviders || isInFlight}
      className="flex size-full min-h-dvh items-center justify-center bg-layer-raised px-6 py-8 text-center"
    >
      <div className="flex w-full max-w-[420px] flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-3">
          <h1 className="dial-h1-text text-primary">
            {t(AuthI18nKeys.OverlayLoginTitle)}
          </h1>
          <p className="dial-body-text text-secondary">
            {t(AuthI18nKeys.OverlayLoginDescription)}
          </p>
        </div>

        {hasProviderConfiguration && isLoadingProviders && (
          <p className="dial-body-text text-primary">
            {t(AuthI18nKeys.OverlayProviderPickerLoading)}
          </p>
        )}

        {/* Always mounted: an alert that mounts together with its message is
            announced unreliably, so only its text and the retry button
            toggle. While hidden it is taken out of the flow. */}
        <div
          className={mergeClasses(
            isProvidersErrorShown
              ? 'flex flex-col items-center gap-3'
              : 'sr-only',
          )}
        >
          <p role="alert" className="dial-small-text text-error">
            {isProvidersErrorShown ? t(AuthI18nKeys.OverlayProvidersError) : ''}
          </p>
          {isProvidersErrorShown && (
            <NeutralButton
              className="min-h-11"
              label={t(ButtonsI18nKeys.Retry)}
              onClick={retryLoadProviders}
            />
          )}
        </div>

        {hasProviderConfiguration &&
          !isLoadingProviders &&
          !hasProviderError &&
          providers !== null &&
          providers.length > 0 && (
            <div className="flex w-full flex-col gap-3">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className="flex w-full flex-col items-center gap-2"
                >
                  <NeutralButton
                    className="min-h-11 w-full"
                    label={provider.label}
                    disabled={isLoginDisabled}
                    iconBefore={<ProviderIcon providerId={provider.id} />}
                    onClick={() => openProviderLogin(provider.id)}
                  />
                </div>
              ))}
            </div>
          )}

        {/* Always mounted: a live region that mounts in the same render as its
            text is announced unreliably, so only its text toggles. */}
        <p
          role="alert"
          className={mergeClasses(
            'dial-small-text text-error',
            !isBlocked && 'sr-only',
          )}
        >
          {isBlocked ? t(AuthI18nKeys.OverlayExternalLoginBlocked) : ''}
        </p>

        <p
          role="status"
          aria-live="polite"
          className={mergeClasses(
            'dial-small-text text-error',
            !isTakingLonger && 'sr-only',
          )}
        >
          {isTakingLonger ? t(AuthI18nKeys.OverlayLoginTakingLonger) : ''}
        </p>

        {showSingleLogin && (
          <PrimaryButton
            className="min-h-11"
            label={t(ButtonsI18nKeys.LogIn)}
            disabled={isLoginDisabled}
            onClick={openLogin}
          />
        )}
      </div>
    </section>
  );
};

export default memo(OverlayLoginGate);
