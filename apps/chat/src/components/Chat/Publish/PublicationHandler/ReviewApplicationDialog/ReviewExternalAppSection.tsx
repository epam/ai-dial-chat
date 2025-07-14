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
      <span className="max-w-[414px] break-all text-primary">
        {externalUrl}
      </span>
    </div>
  );
};
