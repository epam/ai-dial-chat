import { useTranslation } from 'next-i18next';

import { ModalState } from '@/src/types/modal';
import { PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import Modal from '../../Common/Modal';
import { RuleListItem } from './RuleListItem';

import { isEqual, uniqBy } from 'lodash-es';

interface Props {
  allRules: [string, PublicationRule[]][];
  newRulesToCompare: PublicationRule[];
  oldRulesToCompare: PublicationRule[];
  newRulesPath: string;
  onClose: () => void;
}

export function CompareRulesModal({
  allRules,
  newRulesToCompare,
  oldRulesToCompare,
  newRulesPath,
  onClose,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const createdRules = newRulesToCompare.filter(
    (rule) =>
      !oldRulesToCompare.some((r) => r.source === rule.source) ||
      !isEqual(
        oldRulesToCompare.find((r) => rule.source === r.source)?.targets,
        rule.targets,
      ),
  );
  const deletedRules = oldRulesToCompare.filter(
    (rule) =>
      !newRulesToCompare.some((r) => r.source === rule.source) ||
      !isEqual(
        newRulesToCompare.find((r) => rule.source === r.source)?.targets,
        rule.targets,
      ),
  );

  return (
    <Modal
      portalId="theme-main"
      state={ModalState.OPENED}
      dataQa="compare-rules"
      containerClassName="m-auto flex max-h-full w-full flex-col overflow-y-auto py-6 xl:max-w-[1000px]"
      onClose={onClose}
      headingClassName="px-6"
      heading={t('Comparison')}
    >
      <div className="grid grid-cols-2 gap-x-5">
        <p className="mb-3 pl-6 text-sm">{t('Previous Access Settings')}</p>
        <p className="mb-3 pr-6 text-sm">{t('Current Access Settings')}</p>
        <div className="pl-6">
          <div>
            {allRules.map(([path, rules]) => (
              <RuleListItem key={path} path={path} rules={rules} />
            ))}
          </div>
        </div>
        <div className="pr-6">
          <div>
            {allRules.map(([path, rules]) => (
              <RuleListItem key={path} path={path} rules={rules} />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-5 bg-layer-2 p-3 px-6">
        <div>
          {oldRulesToCompare && (
            <RuleListItem
              ruleSourcesToApplyClassNames={deletedRules.map((r) => r.source)}
              ruleClassNames="bg-error text-error"
              path={newRulesPath}
              rules={oldRulesToCompare.map((rule) => ({
                function: rule.function,
                targets: rule.targets,
                source: rule.source,
              }))}
            />
          )}
        </div>
        <div>
          {newRulesToCompare && (
            <RuleListItem
              ruleSourcesToApplyClassNames={createdRules.map((r) => r.source)}
              ruleClassNames="bg-accent-secondary-alpha text-accent-secondary"
              path={newRulesPath}
              rules={newRulesToCompare.map((rule) => ({
                function: rule.function,
                targets: rule.targets,
                source: rule.source,
              }))}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
