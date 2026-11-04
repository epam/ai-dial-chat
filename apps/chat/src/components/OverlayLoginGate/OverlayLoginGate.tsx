import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  NeutralButton,
  PrimaryButton,
  StateScreen,
  LiveRegion,
  LiveRegionElement,
  LiveRegionPoliteness,
} from '@epam/ai-dial-ui-kit';
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

  /* StateScreen draws the named `section`, the `h1` and the description; the
     busy flag sits on the action block because StateScreen takes no aria-busy. */
  return (
    <StateScreen
      className="min-h-dvh bg-layer-raised px-6 py-8 text-center"
      title={t(AuthI18nKeys.OverlayLoginTitle)}
      description={t(AuthI18nKeys.OverlayLoginDescription)}
      action={
        <div
          aria-busy={isLoadingProviders || isInFlight}
          className="flex w-full max-w-[420px] flex-col items-center gap-5"
        >
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
            <LiveRegion
              politeness={LiveRegionPoliteness.Assertive}
              as={LiveRegionElement.P}
              className="dial-small-text text-error"
            >
              {isProvidersErrorShown && t(AuthI18nKeys.OverlayProvidersError)}
            </LiveRegion>
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

          <LiveRegion
            politeness={LiveRegionPoliteness.Assertive}
            as={LiveRegionElement.P}
            className="dial-small-text text-error"
          >
            {isBlocked && t(AuthI18nKeys.OverlayExternalLoginBlocked)}
          </LiveRegion>

          <LiveRegion
            as={LiveRegionElement.P}
            className="dial-small-text text-error"
          >
            {isTakingLonger && t(AuthI18nKeys.OverlayLoginTakingLonger)}
          </LiveRegion>

          {showSingleLogin && (
            <PrimaryButton
              className="min-h-11"
              label={t(ButtonsI18nKeys.LogIn)}
              disabled={isLoginDisabled}
              onClick={openLogin}
            />
          )}
        </div>
      }
    />
  );
};

export default memo(OverlayLoginGate);
