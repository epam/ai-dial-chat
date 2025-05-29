import { useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { mapRuleToFilter } from '@/src/utils/app/publications';

import {
  Publication,
  PublicationRule,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { RulesInput } from '@/src/components/Chat/Publish/RulesInput';
import { Spinner } from '@/src/components/Common/Spinner';

import { RuleListItem } from '../RuleListItem';

interface FilterComponentProps {
  filteredRuleEntries: [string, PublicationRule[]][];
  newRules: PublicationRule[];
  publication: Publication;
  isRulesLoading: boolean;
}

const isEditing = true;

export function PublicationFilters({
  filteredRuleEntries,
  newRules,
  publication,
  isRulesLoading,
}: FilterComponentProps) {
  const { t } = useTranslation(Translation.Chat);

  const [isRulesSetterVisible, setIsRulesSetterVisible] = useState(false);
  const [editingRules, setEditingRules] = useState<TargetAudienceFilter[]>([]);

  useEffect(() => {
    if (newRules) {
      setEditingRules(newRules.map(mapRuleToFilter));
    }
  }, [newRules]);

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
      {isNoRulesToDisplay && (
        <p className="text-sm text-secondary" data-qa="availability-label">
          {t(
            'This publication will be available to all users in the organization',
          )}
        </p>
      )}
      {oldRules.map(([path, rules]) => (
        <RuleListItem key={path} path={path} rules={rules} />
      ))}
      {isNewRules && !isEditing && (
        <RuleListItem path={publication.targetFolder} rules={newRules} />
      )}
      {isNewRules && isEditing && (
        <RulesInput
          isOpen={isRulesSetterVisible}
          filters={editingRules}
          setFilters={setEditingRules}
          onSwitchRulesSetter={setIsRulesSetterVisible}
        />
      )}
    </>
  );
}
