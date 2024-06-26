import { Fragment } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import Tooltip from '../../Common/Tooltip';

import { startCase, toLower } from 'lodash-es';

interface Props {
  path: string;
  rules: PublicationRule[];
  ruleSourcesToApplyClassNames?: string[];
  ruleClassNames?: string;
}

export function RuleListItem({
  path,
  rules,
  ruleSourcesToApplyClassNames,
  ruleClassNames,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  return (
    <>
      <div className="mb-1 text-xs text-secondary">{path.split('/').pop()}</div>
      <div className="mb-3 flex flex-wrap gap-1 text-xs">
        {rules.map((rule, idx) => (
          <div key={rule.source} className="flex max-w-full items-center">
            <Tooltip
              contentClassName="max-w-[400px] break-all"
              triggerClassName="truncate whitespace-pre"
              tooltip={
                <div className="flex break-words">
                  {startCase(toLower(rule.source))} {toLower(rule.function)}{' '}
                  {rule.targets.join(` ${t('or')} `)}
                </div>
              }
            >
              <div
                className={classNames(
                  'h-[31px] truncate rounded px-3 py-2',
                  ruleSourcesToApplyClassNames?.some(
                    (source) => source === rule.source,
                  )
                    ? ruleClassNames
                    : 'bg-layer-4',
                )}
              >
                <span className="font-semibold">
                  {startCase(toLower(rule.source))}{' '}
                </span>
                <span className="font-normal italic">
                  {toLower(rule.function)}{' '}
                </span>
                {rule.targets.map((target, index) => (
                  <Fragment key={index}>
                    {index > 0 && (
                      <span className="mx-1 italic">{t('or')}</span>
                    )}
                    <span className="font-semibold">{target}</span>
                  </Fragment>
                ))}
              </div>
            </Tooltip>
            {idx !== rules.length - 1 && (
              <span className="mx-1 italic">{t('or')}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
