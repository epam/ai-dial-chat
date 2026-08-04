import { UsageModelTable, UsageSummaryCard } from '@epam/ai-dial-kit';
import { DialSpinner, NeutralButton } from '@epam/ai-dial-ui-kit';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import ProfileSettingsNav from '../../components/ProfileSettingsNav/ProfileSettingsNav';
import {
  ButtonsI18nKeys,
  SettingsI18nKeys,
} from '../../constants/translation-keys';
import { useAccountUsage } from '../../hooks/useAccountUsage';

type Props = Record<string, never>;

const ProfileUsage: FC<Props> = () => {
  const { t } = useTranslation();
  const { windows, rows, isLoading, hasError, refresh } = useAccountUsage();

  return (
    <div className="flex h-full min-h-0 w-full">
      <ProfileSettingsNav />

      <div className="min-w-0 flex-1 overflow-auto p-6 desktop:p-10">
        <div className="mx-auto flex max-w-[1000px] flex-col">
          <h1 className="dial-display2-text">{t(SettingsI18nKeys.Usage)}</h1>
          <p className="dial-tiny-text mb-6 mt-2 max-w-[640px] text-secondary">
            {t(SettingsI18nKeys.UsagePageSubtitle)}
          </p>

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <DialSpinner />
              <span role="status" aria-live="polite" className="sr-only">
                {t(SettingsI18nKeys.UsageLoading)}
              </span>
            </div>
          )}

          {!isLoading && hasError && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-start gap-3 py-16"
            >
              <p className="dial-body-text">
                {t(SettingsI18nKeys.UsageLoadError)}
              </p>
              <NeutralButton
                label={t(ButtonsI18nKeys.Retry)}
                onClick={refresh}
              />
            </div>
          )}

          {!isLoading && !hasError && (
            <>
              <UsageSummaryCard windows={windows} className="mb-10" />

              <div className="mb-5 flex items-baseline gap-2.5">
                <span className="dial-h3-text">
                  {t(SettingsI18nKeys.UsageByModel)}
                </span>
                <span className="dial-small-semi-text text-secondary">
                  {rows.length}
                </span>
              </div>

              <UsageModelTable rows={rows} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(ProfileUsage);
