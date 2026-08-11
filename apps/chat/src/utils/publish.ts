import { CatalogEntityType } from '@epam/ai-dial-catalog';
import type { PublishHistoryEntryDto } from '@epam/ai-dial-chat-api-client';
import {
  PublishAccessRulesLabels,
  PublishHistoryEntry,
} from '@epam/ai-dial-publish-panel';
import type { TFunction } from 'i18next';
import {
  ButtonsI18nKeys,
  PublishAccessRulesI18nKeys,
} from '../constants/translation-keys';
import { CatalogPublishEntityType } from '../server-api/publish.api';

const PUBLISHABLE_ENTITY_TYPES: Partial<
  Record<CatalogEntityType, CatalogPublishEntityType>
> = {
  [CatalogEntityType.Model]: CatalogPublishEntityType.Model,
  [CatalogEntityType.Toolset]: CatalogPublishEntityType.Toolset,
  [CatalogEntityType.Agent]: CatalogPublishEntityType.Application,
};

/** Maps a catalog item's entity type to the publish API's entity-type path param, or `undefined` if that type is not publishable. */
export const toPublishEntityType = (
  type: CatalogEntityType,
): CatalogPublishEntityType | undefined => PUBLISHABLE_ENTITY_TYPES[type];

/** Maps a publish-history API response entry to the catalog lib's `PublishHistoryEntry` model. */
export const mapPublishHistoryEntryDto = (
  dto: PublishHistoryEntryDto,
): PublishHistoryEntry => ({
  version: dto.version,
  publishedAt: Date.parse(dto.publishedAt),
  folderPath: dto.folderPath.split('/').filter(Boolean),
});

/** Builds the translated `accessRulesLabels` overrides shared by every publish panel host (catalog, conversation). */
export const getAccessRulesLabels = (
  t: TFunction,
): PublishAccessRulesLabels => ({
  heading: t(PublishAccessRulesI18nKeys.Heading),
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
    patternLabel: t(PublishAccessRulesI18nKeys.PatternLabel),
    patternPlaceholder: t(PublishAccessRulesI18nKeys.PatternPlaceholder),
    invalidRegexError: t(PublishAccessRulesI18nKeys.InvalidRegexError),
    saveLabel: t(ButtonsI18nKeys.Save),
    cancelLabel: t(ButtonsI18nKeys.Cancel),
    dialogAriaLabel: t(PublishAccessRulesI18nKeys.DialogAriaLabel),
  },
});
