import { Fragment } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

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
            <div
              className={classNames(
                'flex flex-wrap gap-x-1 rounded px-3 py-2',
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
                  {index > 0 && <span className="italic">{t('or')}</span>}
                  <span className="break-all font-semibold">{target}</span>
                </Fragment>
              ))}
            </div>
            {idx !== rules.length - 1 && (
              <span className="mx-1 italic text-secondary">{t('or')}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
