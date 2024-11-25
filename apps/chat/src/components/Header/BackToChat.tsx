import { IconMessage2 } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { Translation } from '@/src/types/translation';

import Tooltip from '../Common/Tooltip';

export const BackToChat = () => {
  const { t } = useTranslation(Translation.Header);

  const router = useRouter();

  return (
    <Tooltip isTriggerClickable tooltip={t('Back to Chat')}>
      <button
        className="flex h-full items-center justify-center border-r border-tertiary px-[9px]"
        onClick={() => {
          router.push('/');
        }}
      >
        <div
          className="flex cursor-pointer items-center justify-center rounded border border-transparent bg-accent-primary-alpha p-[2px] hover:border-accent-primary disabled:cursor-not-allowed md:px-[10px]"
          data-qa="back-to-chat"
        >
          <IconMessage2 className="text-accent-primary" size={24} />
        </div>
      </button>
    </Tooltip>
  );
};
