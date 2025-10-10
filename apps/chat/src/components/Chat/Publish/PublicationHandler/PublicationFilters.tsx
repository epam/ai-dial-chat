import { useCallback, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { mapFilterToRule, mapRuleToFilter } from '@/src/utils/app/publications';

import {
  Publication,
  PublicationRule,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.selectors';

import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { RulesInput } from '@/src/components/Chat/Publish/RulesInput';
import { Spinner } from '@/src/components/Common/Spinner';

import { RuleListItem } from '../RuleListItem';

interface FilterComponentProps {
  filteredRuleEntries: [string, PublicationRule[]][];
  newRules: PublicationRule[];
  publication: Publication;
  isRulesLoading: boolean;
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

export function PublicationFilters({
  filteredRuleEntries,
  newRules,
  publication,
  isRulesLoading,
}: FilterComponentProps) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );
  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const rulesOnEdit = useAppSelector(PublicationSelectors.selectRulesOnEdit);
  const editedPublishToUrl = useAppSelector(
    PublicationSelectors.selectPublishToUrl,
  );

  const [isRulesSetterVisible, setIsRulesSetterVisible] = useState(false);

  const filters = useMemo(
    () => rulesOnEdit?.map(mapRuleToFilter) ?? [],
    [rulesOnEdit],
  );

  const handleFilterUpdate = useCallback(
    (newFilters: TargetAudienceFilter[]) => {
      dispatch(
        PublicationActions.setRulesOnEdit(newFilters.map(mapFilterToRule)),
      );
    },
    [dispatch],
  );

  const targetFolder = publicationModel
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
        publicationModel ? editedPublishToUrl : undefined,
      ) && (
        <p className="text-sm text-secondary" data-qa="availability-label">
          {t(
            'This publication will be available to all users in the organization',
          )}
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
          {publicationModel && (
            <p className="mb-1 text-xs text-secondary" data-qa="published-path">
              {editedPublishToUrl.split('/').pop()}
            </p>
          )}
          <RulesInput
            isOpen={isRulesSetterVisible}
            filters={filters}
            setFilters={handleFilterUpdate}
            onSwitchRulesSetter={setIsRulesSetterVisible}
          />
        </>
      )}
    </>
  );
}
