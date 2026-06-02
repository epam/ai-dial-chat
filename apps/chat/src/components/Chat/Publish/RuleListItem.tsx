import { Fragment } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getLastPathSegment } from '@/src/utils/app/common';
import { getFilterLabel } from '@/src/utils/app/rules';

import { PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
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
      <div className="mb-1 text-xs text-secondary" data-qa="published-path">
        <DialEllipsisTooltip text={getLastPathSegment(path)} />
      </div>
      <div className="mb-3 flex flex-wrap gap-1 text-xs" data-qa="rules-list">
        {rules.map((rule, idx) => (
          <div
            key={`${rule.source}-${idx}`}
            className="flex max-w-full items-center"
            data-qa="rule"
          >
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
              <span className="font-semibold" data-qa="rule-target">
                {startCase(toLower(rule.source))}
              </span>
              <span className="font-normal italic" data-qa="rule-function">
                {toLower(getFilterLabel(rule.function))}
              </span>
              {rule.targets.map((target, index) => (
                <Fragment key={`${target}-${index}`}>
                  {index > 0 && (
                    <span className="italic" data-qa="inner-operator">
                      {t(ChatI18nKeys.Or)}
                    </span>
                  )}
                  <span
                    className="break-all font-semibold"
                    data-qa="rule-value"
                  >
                    {target}
                  </span>
                </Fragment>
              ))}
            </div>
            {idx !== rules.length - 1 && (
              <span
                className="mx-1 italic text-secondary"
                data-qa="rule-operator"
              >
                {t(ChatI18nKeys.Or)}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
