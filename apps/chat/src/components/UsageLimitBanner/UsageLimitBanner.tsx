import { useUsageLimitBanner } from '@epam/ai-dial-chat-hooks';
import { UsageLimitBannerView } from '@epam/ai-dial-conversation-input';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppConfig } from '../../context/AppConfigContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { getDeploymentLimits } from '../../server-api/deployment-limits';

interface Props {
  /** ID of the currently selected deployment. */
  deploymentId: string | undefined;
  /** Whether the selected deployment is currently generating a response. */
  isGenerationInProgress?: boolean;
}

const UsageLimitBanner: FC<Props> = ({
  deploymentId,
  isGenerationInProgress = false,
}) => {
  /* Widened to the plain key/params signature the hook's `t` takes,
     matching `UsageLimitsControl`'s own cast. */
  const { t } = useTranslation() as {
    t: (key: string, params?: Record<string, unknown>) => string;
  };
  const { language: activeLocale } = useLanguage();
  const {
    config: { usageLimitsWarningThresholdPercent },
  } = useAppConfig();

  const { banner } = useUsageLimitBanner({
    deploymentId,
    isGenerationInProgress,
    getDeploymentLimits,
    warningThresholdPercent: usageLimitsWarningThresholdPercent,
    activeLocale,
    t,
  });

  if (banner == null) {
    return null;
  }

  return <UsageLimitBannerView {...banner} />;
};

export default memo(UsageLimitBanner);
