import { PrimaryButton } from '@epam/ai-dial-ui-kit';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import {
  OverlayExternalLoginStatus,
  useOverlayExternalLogin,
} from '../../hooks/auth/useOverlayExternalLogin';

const OverlayLoginGate: FC = () => {
  const { t } = useTranslation();
  const { status, openLogin } = useOverlayExternalLogin();
  const isInFlight =
    status === OverlayExternalLoginStatus.Opening ||
    status === OverlayExternalLoginStatus.Waiting ||
    status === OverlayExternalLoginStatus.TakingLonger;
  const isLoginDisabled =
    status === OverlayExternalLoginStatus.Opening ||
    status === OverlayExternalLoginStatus.Waiting;

  return (
    <section
      aria-busy={isInFlight}
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

        {status === OverlayExternalLoginStatus.Blocked && (
          <p role="alert" className="dial-small-text text-error">
            {t(AuthI18nKeys.OverlayExternalLoginBlocked)}
          </p>
        )}

        {status === OverlayExternalLoginStatus.TakingLonger && (
          <p aria-live="polite" className="dial-small-text text-error">
            {t(AuthI18nKeys.OverlayLoginTakingLonger)}
          </p>
        )}

        <PrimaryButton
          label={t(ButtonsI18nKeys.LogIn)}
          disabled={isLoginDisabled}
          onClick={openLogin}
        />
      </div>
    </section>
  );
};

export default memo(OverlayLoginGate);
