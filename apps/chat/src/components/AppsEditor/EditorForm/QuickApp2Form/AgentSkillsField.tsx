import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSharedTooltip } from '@/src/utils/app/application';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors } from '@/src/store/selectors';

import { PUBLIC_APP_TOOLTIP } from '@/src/constants/applications';
import { MarketplaceI18nKeys } from '@/src/constants/i18n';

import { QuickApp2Form } from '@/src/components/AppsEditor/form';
import { AgentSkillsSelector } from '@/src/components/Common/AgentSkillsSelector/AgentSkillsSelector';
import { withLabel } from '@/src/components/Common/Forms/Label';

const AgentSkillsSelectorField = withLabel(AgentSkillsSelector);

export const AgentSkillsField: FC = () => {
  const { t } = useTranslation(Translation.Marketplace);

  const { control } = useFormContext<QuickApp2Form>();

  const appDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

  const isAppPublic = !!appDetails && isEntityIdPublic(appDetails);
  const isSharedWithMe = !!appDetails?.sharedWithMe;

  return (
    <Controller
      name="agentSkills"
      control={control}
      render={({ field }) => (
        <AgentSkillsSelectorField
          label={t(MarketplaceI18nKeys.AgentSkills)}
          value={field.value}
          onChange={field.onChange}
          readonly={isAppPublic}
          tooltip={isAppPublic ? PUBLIC_APP_TOOLTIP : undefined}
          addBtnTooltip={
            isSharedWithMe
              ? getSharedTooltip(t(MarketplaceI18nKeys.SkillsLowercase))
              : undefined
          }
        />
      )}
    />
  );
};
