import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { memo, type FC, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { OverlayExternalLoginStatus } from '../../hooks/auth/useOverlayExternalLogin';
import { useOverlayProviderLogin } from '../../hooks/auth/useOverlayProviderLogin';

const getProviderIconUrl = (providerId: string): string =>
  `https://authjs.dev/img/providers/${providerId.replace(/[1-9]\d*$/, '')}.svg`;

const handleProviderIconError = (
  event: SyntheticEvent<HTMLImageElement>,
): void => {
  event.currentTarget.style.display = 'none';
};

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
  const isInFlight =
    externalLoginStatus === OverlayExternalLoginStatus.Opening ||
    externalLoginStatus === OverlayExternalLoginStatus.Waiting ||
    externalLoginStatus === OverlayExternalLoginStatus.TakingLonger;
  const isLoginDisabled =
    externalLoginStatus === OverlayExternalLoginStatus.Opening;
  const showSingleLogin =
    !hasProviderConfiguration ||
    (!isLoadingProviders &&
      !hasProviderError &&
      providers !== null &&
      providers.length === 0);

  return (
    <section
      aria-busy={isLoadingProviders || isInFlight}
      className="flex size-full min-h-dvh items-center justify-center bg-layer-0 px-6 py-8 text-center"
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

        {hasProviderConfiguration &&
          !isLoadingProviders &&
          hasProviderError && (
            <div className="flex flex-col items-center gap-3">
              <p role="alert" className="dial-small-text text-error">
                {t(AuthI18nKeys.OverlayProvidersError)}
              </p>
              <NeutralButton
                className="min-h-11"
                label={t(ButtonsI18nKeys.Retry)}
                onClick={retryLoadProviders}
              />
            </div>
          )}

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
                    iconBefore={
                      <img
                        src={getProviderIconUrl(provider.id)}
                        alt=""
                        aria-hidden="true"
                        className="size-5 shrink-0"
                        onError={handleProviderIconError}
                      />
                    }
                    onClick={() => openProviderLogin(provider.id)}
                  />
                </div>
              ))}
            </div>
          )}

        {externalLoginStatus === OverlayExternalLoginStatus.Blocked && (
          <p role="alert" className="dial-small-text text-error">
            {t(AuthI18nKeys.OverlayExternalLoginBlocked)}
          </p>
        )}

        {externalLoginStatus === OverlayExternalLoginStatus.TakingLonger && (
          <p aria-live="polite" className="dial-small-text text-error">
            {t(AuthI18nKeys.OverlayLoginTakingLonger)}
          </p>
        )}

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
