import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DialButton,
  DialSpinner,
  GhostIconButton,
  Notification,
  NotificationType,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import { IconPlus, IconX } from '@tabler/icons-react';
import { FC, useEffect, useRef, useState } from 'react';
import { PublicationRule, PublicationRuleFunction } from '../../models/publish';
import {
  PublishAccessRuleEditor,
  PublishAccessRuleEditorLabels,
} from '../PublishAccessRuleEditor/PublishAccessRuleEditor';

const MAX_RULES_DEFAULT = 20;

/** Text overrides for all user-visible strings in {@link PublishAccessRules}. */
export interface PublishAccessRulesLabels {
  /** Section heading. Default: `'Allow access if all match'`. */
  heading?: string;
  /** Label for the trigger that opens the single-rule editor. Default: `'Add rule'`. */
  addRuleLabel?: string;
  /** Label for the control that removes every rule; shown only when at least one rule exists. Default: `'Clear all'`. */
  clearAllLabel?: string;
  /** Separator joining a rule's targets. Default: `'Or'`. */
  orSeparatorLabel?: string;
  /** Accessible name template for a chip's remove control; `{source}` and `{targets}` are replaced. Default: `'Remove rule for {source}: {targets}'`. */
  removeRuleAriaLabelTemplate?: string;
  /** Chip label for an `EQUAL` rule. Default: `'Equal'`. */
  equalFunctionLabel?: string;
  /** Chip label for a `CONTAIN` rule. Default: `'Contain'`. */
  containFunctionLabel?: string;
  /** Chip label for a `REGEX` rule. Default: `'Regex'`. */
  regexFunctionLabel?: string;
  /** Shown while existing rules are being fetched for the selected folder. Default: `'Loading existing rules…'`. */
  loadingLabel?: string;
  /** Shown when fetching existing rules for the selected folder failed. Default: `"Couldn't load existing rules for this folder. You can still add rules manually."`. */
  loadErrorLabel?: string;
  /** Live-region announcement after a rule is added. Default: `'Rule added.'`. */
  ruleAddedAnnouncement?: string;
  /** Live-region announcement after a rule is removed. Default: `'Rule removed.'`. */
  ruleRemovedAnnouncement?: string;
  /** Live-region announcement after all rules are cleared. Default: `'All rules cleared.'`. */
  rulesClearedAnnouncement?: string;
  /** Live-region announcement after existing rules are loaded for a selected folder. Default: `'Existing rules loaded for the selected folder.'`. */
  rulesLoadedAnnouncement?: string;
  /** Text overrides passed through to the nested single-rule editor. */
  editorLabels?: PublishAccessRuleEditorLabels;
}

/** Props for {@link PublishAccessRules}. */
export interface PublishAccessRulesProps {
  /** Current access rules, combined with AND. */
  rules: PublicationRule[];
  /** Called with the full next rules array on add, remove, or clear. */
  onRulesChange: (rules: PublicationRule[]) => void;
  /** Options offered in the single-rule editor's source picker. */
  sourceOptions: string[];
  /** Disables every control in the section, e.g. while a publish request is in flight. Default: `false`. */
  disabled?: boolean;
  /** Whether existing rules are currently being fetched for the selected folder. Default: `false`. */
  isLoading?: boolean;
  /** Whether the most recent existing-rules fetch failed. Default: `false`. */
  hasLoadError?: boolean;
  /** Maximum number of rules allowed. Default: `20`. */
  maxRules?: number;
  /** Maximum number of targets allowed per EQUAL/CONTAIN rule. Default: `20`. */
  maxTargetsPerRule?: number;
  /** Text overrides for all user-visible strings. */
  labels?: PublishAccessRulesLabels;
}

const functionLabel = (
  fn: PublicationRuleFunction,
  labels: { equal: string; contain: string; regex: string },
): string => {
  if (fn === PublicationRuleFunction.Equal) return labels.equal;
  if (fn === PublicationRuleFunction.Contain) return labels.contain;
  return labels.regex;
};

/**
 * Chip list for the access-rules section: renders each rule as a removable
 * chip, an "Add rule" trigger opening {@link PublishAccessRuleEditor}, and a
 * "Clear all" control shown only when rules are present. Announces add,
 * remove, clear, and pre-fill-from-folder-selection through a shared
 * `aria-live="polite"` status region.
 */
export const PublishAccessRules: FC<PublishAccessRulesProps> = ({
  rules,
  onRulesChange,
  sourceOptions,
  disabled = false,
  isLoading = false,
  hasLoadError = false,
  maxRules = MAX_RULES_DEFAULT,
  maxTargetsPerRule,
  labels = {},
}) => {
  const {
    heading = 'Allow access if all match',
    addRuleLabel = 'Add rule',
    clearAllLabel = 'Clear all',
    orSeparatorLabel = 'Or',
    removeRuleAriaLabelTemplate = 'Remove rule for {source}: {targets}',
    equalFunctionLabel = 'Equal',
    containFunctionLabel = 'Contain',
    regexFunctionLabel = 'Regex',
    loadingLabel = 'Loading existing rules…',
    loadErrorLabel:
      loadErrorLabelText = "Couldn't load existing rules for this folder. You can still add rules manually.",
    ruleAddedAnnouncement = 'Rule added.',
    ruleRemovedAnnouncement = 'Rule removed.',
    rulesClearedAnnouncement = 'All rules cleared.',
    rulesLoadedAnnouncement = 'Existing rules loaded for the selected folder.',
    editorLabels,
  } = labels;

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  /*
   * Captures whatever had focus (typically the "Add rule" trigger) before the
   * editor opened, so focus can be restored to it once the editor closes —
   * works regardless of the underlying ui-kit button's ref-forwarding.
   */
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const wasLoadingRef = useRef(isLoading);
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading && rules.length > 0) {
      setStatusMessage(rulesLoadedAnnouncement);
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading, rules, rulesLoadedAnnouncement]);

  const openEditor = () => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    previousFocusRef.current?.focus?.();
  };

  const handleAddRule = (rule: PublicationRule) => {
    onRulesChange([...rules, rule]);
    setStatusMessage(ruleAddedAnnouncement);
    closeEditor();
  };

  const handleRemoveRule = (index: number) => {
    onRulesChange(rules.filter((_, i) => i !== index));
    setStatusMessage(ruleRemovedAnnouncement);
  };

  const handleClearAll = () => {
    onRulesChange([]);
    setStatusMessage(rulesClearedAnnouncement);
  };

  const functionLabels = {
    equal: equalFunctionLabel,
    contain: containFunctionLabel,
    regex: regexFunctionLabel,
  };

  const isAddDisabled = disabled || rules.length >= maxRules;

  return (
    <div className={mergeClasses(disabled && 'pointer-events-none opacity-60')}>
      <span role="status" aria-live="polite" className="sr-only">
        {statusMessage}
      </span>

      <div className="dial-body-semi-text mb-2 text-primary">{heading}</div>

      {isLoading && (
        <div className="mb-2 flex items-center gap-2 text-secondary">
          <DialSpinner size={16} ariaLabel={loadingLabel} />
          <span className="dial-small-text">{loadingLabel}</span>
        </div>
      )}

      {hasLoadError && (
        <div className="mb-2">
          <Notification
            type={NotificationType.SectionMessage}
            variant={NotificationVariant.Warning}
            message={loadErrorLabelText}
          />
        </div>
      )}

      {rules.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {rules.map((rule, index) => {
            const targetsText = rule.targets.join(` ${orSeparatorLabel} `);
            const removeAriaLabel = removeRuleAriaLabelTemplate
              .replace('{source}', rule.source)
              .replace('{targets}', targetsText);
            return (
              <li
                key={index}
                className="flex items-center justify-between gap-2 rounded-lg border border-tertiary bg-layer-2 px-3 py-2"
              >
                <span className="dial-small-text truncate text-primary">
                  <span className="font-semibold">{rule.source}</span>{' '}
                  {functionLabel(rule.function, functionLabels)}: {targetsText}
                </span>
                <GhostIconButton
                  icon={<IconX size={DIAL_ICON_SIZE.SM} aria-hidden />}
                  aria-label={removeAriaLabel}
                  onClick={() => handleRemoveRule(index)}
                  disabled={disabled}
                />
              </li>
            );
          })}
        </ul>
      )}

      {isEditorOpen && (
        <PublishAccessRuleEditor
          sourceOptions={sourceOptions}
          onSave={handleAddRule}
          onCancel={closeEditor}
          disabled={disabled}
          maxTargets={maxTargetsPerRule}
          labels={editorLabels}
        />
      )}

      <div className="flex items-center gap-2">
        <DialButton
          appearance={ButtonAppearance.Ghost}
          variant={ButtonVariant.Secondary}
          label={addRuleLabel}
          iconBefore={<IconPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
          onClick={openEditor}
          disabled={isAddDisabled}
        />
        {rules.length > 0 && (
          <DialButton
            appearance={ButtonAppearance.Ghost}
            variant={ButtonVariant.Secondary}
            label={clearAllLabel}
            onClick={handleClearAll}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
};
