import { UsageModelTable, UsageSummaryCard } from '@epam/ai-dial-kit';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import ProfileSettingsNav from '../../components/ProfileSettingsNav/ProfileSettingsNav';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import { MOCK_USAGE_ROWS, MOCK_USAGE_WINDOWS } from './mock-usage-data';

type Props = Record<string, never>;

const ProfileUsage: FC<Props> = () => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full min-h-0 w-full">
      <ProfileSettingsNav />

      <div className="min-w-0 flex-1 overflow-auto p-6 desktop:p-10">
        <div className="mx-auto flex max-w-[1000px] flex-col">
          <h1 className="dial-display2-text">{t(SettingsI18nKeys.Usage)}</h1>
          <p className="dial-tiny-text mb-6 mt-2 max-w-[640px] text-secondary">
            {t(SettingsI18nKeys.UsagePageSubtitle)}
          </p>

          <UsageSummaryCard windows={MOCK_USAGE_WINDOWS} className="mb-10" />

          <div className="mb-5 flex items-baseline gap-2.5">
            <span className="dial-h3-text">
              {t(SettingsI18nKeys.UsageByModel)}
            </span>
            <span className="dial-small-semi-text text-secondary">
              {MOCK_USAGE_ROWS.length}
            </span>
          </div>

          <UsageModelTable rows={MOCK_USAGE_ROWS} />
        </div>
      </div>
    </div>
  );
};

export default memo(ProfileUsage);
