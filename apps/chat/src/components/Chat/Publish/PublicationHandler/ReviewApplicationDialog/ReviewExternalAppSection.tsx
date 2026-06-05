import { IconExternalLink } from '@tabler/icons-react';

import Link from 'next/link';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isExternalApp } from '@/src/utils/app/application';

import {
  CustomApplicationModel,
  ExternalAppConfig,
} from '@/src/types/applications';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { MarketplaceEntityInfoRow } from '../MarketplaceEntityInfoRow';

interface ReviewExternalAppSectionProps {
  application: CustomApplicationModel;
}

export const ReviewExternalAppSection = ({
  application,
}: ReviewExternalAppSectionProps) => {
  const { t } = useTranslation(Translation.Chat);

  const externalUrl = (application?.applicationProperties as ExternalAppConfig)
    ?.external_url;

  if (!externalUrl || !isExternalApp(application)) return null;

  return (
    <MarketplaceEntityInfoRow
      label={t(ChatI18nKeys.ExternalUrl)}
      dataQa="app-external-url-label"
      value={
        <Link
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full flex-nowrap items-center gap-1 break-all text-accent-primary"
          data-qa="app-external-url"
        >
          <p className="min-w-0 flex-1 truncate" title={externalUrl}>
            {externalUrl}
          </p>
          <div className="size-[16px]">
            <IconExternalLink size={DEFAULT_ICON_SIZES.SMALL} />
          </div>
        </Link>
      }
      valueClassName="max-w-[414px]"
    />
  );
};
