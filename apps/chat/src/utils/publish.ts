import { PublishAccessRulesLabels } from '@epam/ai-dial-publish-panel';
import type { TFunction } from 'i18next';
import {
  ButtonsI18nKeys,
  PublishAccessRulesI18nKeys,
} from '../constants/translation-keys';

export {
  mapPublishConversationResultDto,
  mapPublishHistoryEntryDto,
  toPublishEntityType,
  type CatalogPublishEntityType,
} from '@epam/ai-dial-chat-hooks';

/** Builds the translated `accessRulesLabels` overrides shared by every publish panel host (catalog, conversation). */
export const getAccessRulesLabels = (
  t: TFunction,
): PublishAccessRulesLabels => ({
  heading: t(PublishAccessRulesI18nKeys.Heading),
  folderScopeHint: t(PublishAccessRulesI18nKeys.FolderScopeHint),
  noFolderScopeHint: t(PublishAccessRulesI18nKeys.NoFolderScopeHint),
  rulesWithoutFolderWarning: t(
    PublishAccessRulesI18nKeys.RulesWithoutFolderWarning,
  ),
  maxRulesReachedLabel: t(PublishAccessRulesI18nKeys.MaxRulesReachedLabel),
  addRuleLabel: t(PublishAccessRulesI18nKeys.AddRuleLabel),
  clearAllLabel: t(PublishAccessRulesI18nKeys.ClearAllLabel),
  orSeparatorLabel: t(PublishAccessRulesI18nKeys.OrSeparatorLabel),
  removeRuleAriaLabelTemplate: t(
    PublishAccessRulesI18nKeys.RemoveRuleAriaLabelTemplate,
  ),
  equalFunctionLabel: t(PublishAccessRulesI18nKeys.EqualFunctionLabel),
  containFunctionLabel: t(PublishAccessRulesI18nKeys.ContainFunctionLabel),
  regexFunctionLabel: t(PublishAccessRulesI18nKeys.RegexFunctionLabel),
  loadingLabel: t(PublishAccessRulesI18nKeys.LoadingLabel),
  loadErrorLabel: t(PublishAccessRulesI18nKeys.LoadErrorLabel),
  ruleAddedAnnouncement: t(PublishAccessRulesI18nKeys.RuleAddedAnnouncement),
  ruleRemovedAnnouncement: t(
    PublishAccessRulesI18nKeys.RuleRemovedAnnouncement,
  ),
  rulesClearedAnnouncement: t(
    PublishAccessRulesI18nKeys.RulesClearedAnnouncement,
  ),
  rulesLoadedAnnouncement: t(
    PublishAccessRulesI18nKeys.RulesLoadedAnnouncement,
  ),
  editorLabels: {
    sourceLabel: t(PublishAccessRulesI18nKeys.SourceLabel),
    sourcePlaceholder: t(PublishAccessRulesI18nKeys.SourcePlaceholder),
    functionLabel: t(PublishAccessRulesI18nKeys.FunctionLabel),
    equalOptionLabel: t(PublishAccessRulesI18nKeys.EqualFunctionLabel),
    containOptionLabel: t(PublishAccessRulesI18nKeys.ContainFunctionLabel),
    regexOptionLabel: t(PublishAccessRulesI18nKeys.RegexFunctionLabel),
    targetsLabel: t(PublishAccessRulesI18nKeys.TargetsLabel),
    targetsPlaceholder: t(PublishAccessRulesI18nKeys.TargetsPlaceholder),
    targetsHintLabel: t(PublishAccessRulesI18nKeys.TargetsHintLabel),
    requiredFieldError: t(PublishAccessRulesI18nKeys.RequiredFieldError),
    targetsRequiredError: t(PublishAccessRulesI18nKeys.TargetsRequiredError),
    patternLabel: t(PublishAccessRulesI18nKeys.PatternLabel),
    patternPlaceholder: t(PublishAccessRulesI18nKeys.PatternPlaceholder),
    invalidRegexError: t(PublishAccessRulesI18nKeys.InvalidRegexError),
    saveLabel: t(ButtonsI18nKeys.Save),
    cancelLabel: t(ButtonsI18nKeys.Cancel),
    dialogAriaLabel: t(PublishAccessRulesI18nKeys.DialogAriaLabel),
  },
});
