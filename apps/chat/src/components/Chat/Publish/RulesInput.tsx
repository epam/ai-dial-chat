import { IconPlus, IconX } from '@tabler/icons-react';
import { Fragment, useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { TargetAudienceFilter } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { TargetAudienceFilterComponent } from '@/src/components/Chat/Publish/TargetAudienceFilterComponent';

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

  const handleSaveFilter = useCallback(
    (targetFilter: TargetAudienceFilter) => {
      setFilters(
        filters.filter(({ id }) => id !== targetFilter.id).concat(targetFilter),
      );
      onSwitchRulesSetter(false);
    },
    [filters, onSwitchRulesSetter, setFilters],
  );

  return (
    <>
      <div
        className="relative mb-2 flex h-auto min-h-[39px] w-full flex-wrap items-center gap-1 rounded border border-primary px-1 py-[3px] pr-10"
        data-qa="rules-list"
      >
        {filters.map((item) => (
          <div className="flex items-center gap-1" key={item.id} data-qa="rule">
            <div className="flex min-h-[31px] items-center justify-center break-all rounded bg-accent-primary-alpha text-xs">
              <div className="flex flex-wrap gap-1 px-3 py-2 leading-3">
                <span className="font-semibold">
                  {startCase(toLower(item.id))}
                </span>
                <span className="italic">{toLower(item.filterFunction)}</span>
                {item.filterParams.map((param, index) => (
                  <Fragment key={index}>
                    {index > 0 && <span className="italic">{t('or')}</span>}
                    <span className="font-semibold">{param}</span>
                  </Fragment>
                ))}
              </div>
              <IconX
                size={18}
                stroke="1"
                onClick={() => handleRemoveFilter(item.id)}
                className="mr-3 shrink-0 cursor-pointer text-secondary"
              />
            </div>
            <span className="text-xs italic text-secondary">{t('or')}</span>
          </div>
        ))}
        {!isOpen && (
          <button
            onClick={() => onSwitchRulesSetter(true)}
            className="flex h-[31px] w-9 items-center justify-center rounded bg-accent-primary-alpha text-3xl font-thin text-secondary outline-none"
            data-qa="add-rule"
          >
            <IconPlus stroke="1" size={18} />
          </button>
        )}
        {!!filters.length && (
          <IconX
            size={18}
            stroke="2"
            onClick={handleClear}
            className="absolute right-3 top-[10.5px] cursor-pointer text-secondary"
          />
        )}
      </div>
      {isOpen && (
        <TargetAudienceFilterComponent
          onCloseFilter={() => onSwitchRulesSetter(false)}
          onSaveFilter={handleSaveFilter}
        />
      )}
    </>
  );
};
