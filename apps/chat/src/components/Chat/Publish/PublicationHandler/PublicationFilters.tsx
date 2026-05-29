import { useCallback, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { mapFilterToRule, mapRuleToFilter } from '@/src/utils/app/publications';

import {
  Publication,
  PublicationRule,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { RulesInput } from '@/src/components/Chat/Publish/RulesInput';
import { withErrorMessage } from '@/src/components/Common/Forms/FieldErrorMessage';
import { Spinner } from '@/src/components/Common/Spinner';

import { RuleListItem } from '../RuleListItem';
import { PublicationRequestFormData, PublishRequestFieldsNames } from '../form';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface FilterComponentProps {
  filteredRuleEntries: [string, PublicationRule[]][];
  newRules: PublicationRule[];
  publication: Publication;
  isRulesLoading: boolean;
  editedPublishToUrl: string;
  isRulesSetterVisible: boolean;
  onRulesSetterOpenChange: (visible: boolean) => void;
}

const showNoRulesLabel = (
  rulesOnEditLength: number,
  isNoRulesToDisplay: boolean,
  publishToUrl: string | undefined,
) => {
  if (publishToUrl) {
    return (
      !rulesOnEditLength &&
      isNoRulesToDisplay &&
      PUBLIC_URL_PREFIX === publishToUrl
    );
  }

  return isNoRulesToDisplay;
};

function PublicationFiltersView({
  filteredRuleEntries,
  newRules,
  publication,
  isRulesLoading,
  editedPublishToUrl,
  isRulesSetterVisible,
  onRulesSetterOpenChange,
}: FilterComponentProps) {
  const { t } = useTranslation(Translation.Chat);

  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );
  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);

  const { setValue } = useFormContext<PublicationRequestFormData>();

  const rulesOnEdit = useWatch<
    PublicationRequestFormData,
    typeof PublishRequestFieldsNames.RULES
  >({
    name: PublishRequestFieldsNames.RULES,
  });

  const filters = useMemo(
    () => rulesOnEdit?.map(mapRuleToFilter) ?? [],
    [rulesOnEdit],
  );

  const handleFilterUpdate = useCallback(
    (newFilters: TargetAudienceFilter[]) => {
      setValue(
        PublishRequestFieldsNames.RULES,
        newFilters.map(mapFilterToRule),
      );
    },
    [setValue],
  );

  const targetFolder =
    isEditMode || publicationModel
      ? editedPublishToUrl
      : publication.targetFolder;
  const isRootTarget = targetFolder.split('/').length === 1;

  if (isRulesLoading) {
    return (
      <div className="flex size-full items-center justify-center">
        <Spinner size={48} />
      </div>
    );
  }

  const isNoRulesToDisplay =
    (!filteredRuleEntries.length ||
      filteredRuleEntries.every(([_, rules]) => !rules.length)) &&
    !publication.rules?.length;
  const oldRules = filteredRuleEntries.filter(([_, rules]) => rules.length);
  const isNewRules = !!publication.rules?.length && !!publication.targetFolder;

  return (
    <>
      {showNoRulesLabel(
        rulesOnEdit.length,
        isNoRulesToDisplay,
        isEditMode || publicationModel ? editedPublishToUrl : undefined,
      ) && (
        <p className="text-sm text-secondary" data-qa="availability-label">
          {t(ChatI18nKeys.PublicationAvailableToAll)}
        </p>
      )}
      {oldRules.map(([path, rules]) => (
        <RuleListItem key={path} path={path} rules={rules} />
      ))}
      {isNewRules && (!isEditMode || publicationModel) && (
        <RuleListItem path={publication.targetFolder} rules={newRules} />
      )}
      {(isEditMode || publicationModel) && !isRootTarget && (
        <>
          {(publicationModel || isEditMode) && (
            <p className="mb-1 text-xs text-secondary" data-qa="published-path">
              <DialEllipsisTooltip
                text={editedPublishToUrl.split('/').pop() || ''}
              />
            </p>
          )}
          <RulesInput
            isOpen={isRulesSetterVisible}
            filters={filters}
            setFilters={handleFilterUpdate}
            onSwitchRulesSetter={onRulesSetterOpenChange}
          />
        </>
      )}
    </>
  );
}

export const PublicationFilters = withErrorMessage(PublicationFiltersView);
