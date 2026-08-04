import { Fragment } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { usePublicationFilterTranslation } from '@/src/components/Chat/Publish/usePublicationFilterTranslation';

import { DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

interface Props {
  path: string;
  rules: PublicationRule[];
  ruleSourcesToApplyClassNames?: string[];
  ruleClassNames?: string;
}

/**
 * Formats a folder path for display by replacing the first segment (bucket)
 * with a localized "Organization" label and joining the remaining segments.
 * Example: "public/Folder01/Folder02/Folder03" -> "Organization / Folder01 / Folder02 / Folder03"
 */
const formatFolderPathForDisplay = (path: string, organizationLabel: string): string => {
  const segments = path.split('/');
  if (segments.length === 0) return '';

  // Replace first segment (bucket like "public") with organization label
  segments[0] = organizationLabel;

  return segments.join(' / ');
};

export function RuleListItem({
  path,
  rules,
  ruleSourcesToApplyClassNames,
  ruleClassNames,
}: Props) {
  const { t } = useTranslation(Translation.Chat);
  const { translateSource, translateFunction } =
    usePublicationFilterTranslation();

  const displayPath = formatFolderPathForDisplay(path, t(ChatI18nKeys.Organization));

  return (
    <>
      <div className="mb-1 text-xs text-secondary" data-qa="published-path">
        <DialEllipsisTooltip text={displayPath} />
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
                {translateSource(rule.source)}
              </span>
              <span className="font-normal italic" data-qa="rule-function">
                {translateFunction(rule.function).toLowerCase()}
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
