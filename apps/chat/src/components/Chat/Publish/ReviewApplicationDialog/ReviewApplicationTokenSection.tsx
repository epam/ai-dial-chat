import { IconCheck, IconX } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import { CustomApplicationModel } from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

interface ReviewApplicationTokenSectionProps {
  application?: CustomApplicationModel;
}

export const ReviewApplicationTokenSection = ({
  application,
}: ReviewApplicationTokenSectionProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex gap-4">
      <span className="w-[122px] text-secondary">{t('Auth token:')}</span>
      <span className="flex max-w-[414px] items-center gap-2 break-all text-primary">
        {application?.forwardAuthToken ? (
          <>
            <IconCheck size={18} className="stroke-accent-primary" />
            <span>Forward auth token</span>
          </>
        ) : (
          <>
            <IconX size={18} className="stroke-error" />
            <span>Do not forward auth token</span>
          </>
        )}
      </span>
    </div>
  );
};
