import { IconArrowLeft } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { Translation } from '@/src/types/translation';

import Tooltip from '../Common/Tooltip';

export const BackToChatMobile = () => {
  const { t } = useTranslation(Translation.Header);

  const router = useRouter();

  return (
    <Tooltip isTriggerClickable tooltip={t('Back to Chat')}>
      <button
        className="flex h-full items-center justify-center border-r border-tertiary px-2 md:px-3 lg:hidden"
        onClick={() => {
          router.push('/');
        }}
      >
        <div className="flex items-center justify-center rounded p-[3px]">
          <IconArrowLeft
            className="text-secondary hover:text-accent-secondary"
            width={25}
            height={25}
          />
        </div>
      </button>
    </Tooltip>
  );
};
