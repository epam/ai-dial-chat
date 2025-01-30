import { IconClipboardX } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

export const NoData = () => {
  const { t } = useTranslation(Translation.Common);
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <IconClipboardX
        height={60}
        width={60}
        stroke={0.5}
        className="text-secondary"
      />
      <span>{t('No data')}</span>
    </div>
  );
};
