import { IconPlus } from '@tabler/icons-react';
import { Fragment, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getRuleFilterId } from '@/src/utils/app/publications';
import { getFilterLabel } from '@/src/utils/app/rules';

import {
  TargetAudienceFilter,
  TargetAudienceFilterData,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { TargetAudienceFilterComponent } from '@/src/components/Chat/Publish/TargetAudienceFilterComponent';
import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';

import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';
import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

interface RulesInputProps {
  isOpen: boolean;
  filters: TargetAudienceFilter[];
  setFilters: (filters: TargetAudienceFilter[]) => void;
  onSwitchRulesSetter: (isOpen: boolean) => void;
}

export const RulesInput = ({
  isOpen,
  filters,
  setFilters,
  onSwitchRulesSetter,
}: RulesInputProps) => {
  const { t } = useTranslation(Translation.Chat);

  const handleRemoveFilter = useCallback(
    (removeId: string) => {
      setFilters(filters.filter(({ id }) => id !== removeId));
    },
    [filters, setFilters],
  );

  const handleClear = useCallback(() => {
    setFilters([]);
  }, [setFilters]);

  const handleCloseFilter = useCallback(() => {
    onSwitchRulesSetter(false);
  }, [onSwitchRulesSetter]);

  const handleSaveFilter = useCallback(
    (targetFilter: TargetAudienceFilterData) => {
      setFilters(filters.concat({ ...targetFilter, id: getRuleFilterId() }));
      onSwitchRulesSetter(false);
    },
    [filters, onSwitchRulesSetter, setFilters],
  );

  return (
    <>
      <div
        className="relative mb-2 flex h-auto min-h-[38px] w-full flex-wrap items-center gap-1 rounded border border-primary p-1 pe-10"
        data-qa="rules-list"
      >
        {filters.map((item) => (
          <div className="flex items-center gap-1" key={item.id} data-qa="rule">
            <div className="flex min-h-[30px] items-center justify-center gap-2 break-all rounded bg-accent-primary-alpha px-3 text-xs">
              <div className="flex flex-wrap gap-1 py-2 leading-3">
                <span className="font-semibold" data-qa="rule-target">
                  {startCase(toLower(item.source))}
                </span>
                <span className="italic" data-qa="rule-function">
                  {toLower(getFilterLabel(item.filterFunction))}
                </span>
                {item.filterParams.map((param, index) => (
                  <Fragment key={index}>
                    {index > 0 && (
                      <span className="italic" data-qa="inner-operator">
                        {t(ChatI18nKeys.Or)}
                      </span>
                    )}
                    <span className="font-semibold" data-qa="rule-value">
                      {param}
                    </span>
                  </Fragment>
                ))}
              </div>
              <CloseButtonSmall onClick={() => handleRemoveFilter(item.id)} />
            </div>
            <span
              className="text-xs italic text-secondary"
              data-qa="rule-operator"
            >
              {t(ChatI18nKeys.Or)}
            </span>
          </div>
        ))}
        {!isOpen && (
          <div className="flex h-[30px] w-12 items-center justify-center rounded bg-accent-primary-alpha">
            <DialGhostIconButton
              size={ElementSize.Small}
              onClick={() => onSwitchRulesSetter(true)}
              data-qa="add-rule"
              icon={<IconPlus stroke={1.5} size={DEFAULT_ICON_SIZES.SMALL} />}
              className="hover:bg-transparent"
            />
          </div>
        )}
        {!!filters.length && (
          <CloseButtonSmall
            onClick={handleClear}
            className="absolute end-3 top-[7px]"
            aria-label="cancel-all-rules"
          />
        )}
      </div>
      {isOpen && (
        <TargetAudienceFilterComponent
          onCloseFilter={handleCloseFilter}
          onSaveFilter={handleSaveFilter}
        />
      )}
    </>
  );
};
