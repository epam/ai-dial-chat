import React, { FC } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getToolsetMcpUrl } from '@/src/utils/app/toolsets';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { CopyButton } from '@/src/components/Buttons/CopyButton';

interface ToolsetLinkButtonProps {
  id: string;
}

export const ToolsetLinkButton: FC<ToolsetLinkButtonProps> = ({ id }) => {
  const { t } = useTranslation(Translation.Common);
  const { dialCoreExternalUrl } = useAppSelector(
    SettingsSelectors.selectDefaults,
  );

  if (!dialCoreExternalUrl) return null;

  return (
    <CopyButton
      copyContent={getToolsetMcpUrl(id)}
      copyLabel={t(CommonI18nKeys.CopyURL)}
      copiedLabel={t(CommonI18nKeys.Copied)}
    />
  );
};
