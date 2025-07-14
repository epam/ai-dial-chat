import { IconExternalLink } from '@tabler/icons-react';

import Link from 'next/link';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalApp } from '@/src/utils/app/application';

import {
  CustomApplicationModel,
  ExternalAppConfig,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

interface ReviewExternalAppSectionProps {
  application?: CustomApplicationModel;
}

export const ReviewExternalAppSection = ({
  application,
}: ReviewExternalAppSectionProps) => {
  const { t } = useTranslation(Translation.Chat);

  const isExternalApplication = application && isExternalApp(application);

  if (!isExternalApplication) return null;

  const externalUrl = (application?.applicationProperties as ExternalAppConfig)
    ?.external_url;

  return (
    <div className="flex gap-4">
      <span className="w-[122px] text-secondary">{t('External URL:')}</span>
      <Link
        href={externalUrl ?? ''}
        target="_blank"
        rel="noopener noreferrer"
        className="flex max-w-[414px] flex-nowrap items-center gap-1 break-all text-accent-primary"
      >
        {externalUrl} <IconExternalLink size={16}></IconExternalLink>
      </Link>
    </div>
  );
};
