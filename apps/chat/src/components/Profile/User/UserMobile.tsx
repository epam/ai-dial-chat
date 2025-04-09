import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { UserAvatar } from './UserAvatar';

export const UserMobile = () => {
  const { t } = useTranslation(Translation.Header);

  return (
    <div
      className="flex items-center justify-center text-secondary md:text-primary"
      data-qa="account-settings-mobile"
      aria-label={t('Account settings')}
    >
      <UserAvatar />
    </div>
  );
};
